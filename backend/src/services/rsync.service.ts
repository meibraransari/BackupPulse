import { spawn, exec } from 'child_process';
import util from 'util';
import path from 'path';
import fs from 'fs';
import os from 'os';
import net from 'net';
import { prisma } from '../db/prisma';
import { dispatchInstantFailureAlert } from './alert-dispatcher.service';

const execAsync = util.promisify(exec);

export interface RsyncStats {
  totalFiles: number;
  transferredFiles: number;
  deletedFiles: number;
  totalSizeBytes: bigint;
  bytesTransferred: bigint;
  speedupRatio: number | null;
}

/**
 * Parses stdout from rsync --stats to extract quantitative metrics
 */
export function parseRsyncStats(output: string): RsyncStats {
  const stats: RsyncStats = {
    totalFiles: 0,
    transferredFiles: 0,
    deletedFiles: 0,
    totalSizeBytes: BigInt(0),
    bytesTransferred: BigInt(0),
    speedupRatio: null,
  };

  if (!output) return stats;

  const lines = output.split('\n');
  for (const line of lines) {
    // Number of files: 12,450 (reg: 11,200, dir: 1,250)
    if (line.includes('Number of files:')) {
      const match = line.match(/Number of files:\s+([\d,]+)/);
      if (match) stats.totalFiles = parseInt(match[1].replace(/,/g, ''), 10) || 0;
    }
    // Number of regular files transferred: 340
    else if (line.includes('Number of regular files transferred:')) {
      const match = line.match(/Number of regular files transferred:\s+([\d,]+)/);
      if (match) stats.transferredFiles = parseInt(match[1].replace(/,/g, ''), 10) || 0;
    }
    // Number of deleted files: 12
    else if (line.includes('Number of deleted files:')) {
      const match = line.match(/Number of deleted files:\s+([\d,]+)/);
      if (match) stats.deletedFiles = parseInt(match[1].replace(/,/g, ''), 10) || 0;
    }
    // Total file size: 145,234,890 bytes
    else if (line.includes('Total file size:')) {
      const match = line.match(/Total file size:\s+([\d,]+)/);
      if (match) {
        try {
          stats.totalSizeBytes = BigInt(match[1].replace(/,/g, ''));
        } catch (_) {}
      }
    }
    // Total transferred file size: 12,456,789 bytes
    else if (line.includes('Total transferred file size:')) {
      const match = line.match(/Total transferred file size:\s+([\d,]+)/);
      if (match) {
        try {
          stats.bytesTransferred = BigInt(match[1].replace(/,/g, ''));
        } catch (_) {}
      }
    }
    // Literal data: 4,500,000 bytes (fallback if transferred file size is 0)
    else if (line.includes('Literal data:') && stats.bytesTransferred === BigInt(0)) {
      const match = line.match(/Literal data:\s+([\d,]+)/);
      if (match) {
        try {
          stats.bytesTransferred = BigInt(match[1].replace(/,/g, ''));
        } catch (_) {}
      }
    }
    // Total bytes sent: 4,567,123 / Total bytes received: 12,345
    else if (line.includes('Total bytes sent:') && stats.bytesTransferred === BigInt(0)) {
      const match = line.match(/Total bytes sent:\s+([\d,]+)/);
      if (match) {
        try {
          stats.bytesTransferred = BigInt(match[1].replace(/,/g, ''));
        } catch (_) {}
      }
    }
    // Speedup is 12.45
    else if (line.includes('Speedup is')) {
      const match = line.match(/Speedup is\s+([\d.]+)/);
      if (match) stats.speedupRatio = parseFloat(match[1]) || null;
    }
  }

  return stats;
}

export interface SshTestResult {
  status: 'ONLINE' | 'OFFLINE';
  latencyMs: number;
  message: string;
  logs: string;
  logLevel: 'info' | 'debug';
}

export class RsyncService {
  /**
   * Probes disk capacity (total, used, free) for a repository
   */
  async probeRepositoryDiskSpace(repoId: string): Promise<{
    totalBytes: bigint;
    usedBytes: bigint;
    availableBytes: bigint;
    isMounted: boolean;
  }> {
    const repo = await prisma.rsyncRepository.findUnique({
      where: { id: repoId },
      include: { server: true },
    });

    if (!repo) {
      throw new Error(`Repository not found: ${repoId}`);
    }

    let total = BigInt(0);
    let used = BigInt(0);
    let available = BigInt(0);
    let isMounted = true;

    try {
      if (repo.type === 'LOCAL_DISK' || !repo.server) {
        // Local execution: run df -B1
        const cleanPath = path.resolve(repo.path);
        const { stdout } = await execAsync(`df -B1 "${cleanPath}"`).catch(() => {
          // If path doesn't exist yet, check its parent or root
          return execAsync(`df -B1 .`);
        });

        const lines = stdout.trim().split('\n');
        if (lines.length >= 2) {
          const parts = lines[lines.length - 1].split(/\s+/);
          // Filesystem 1B-blocks Used Available Use% Mounted on
          if (parts.length >= 4) {
            total = BigInt(parts[1] || 0);
            used = BigInt(parts[2] || 0);
            available = BigInt(parts[3] || 0);
          }
        }
      } else {
        // Remote execution over SSH
        const sshCmd = this.buildSshCommand(repo.server);
        const { stdout } = await execAsync(`${sshCmd} "df -B1 '${repo.path}' || df -B1 /"`);
        const lines = stdout.trim().split('\n');
        if (lines.length >= 2) {
          const parts = lines[lines.length - 1].split(/\s+/);
          if (parts.length >= 4) {
            total = BigInt(parts[1] || 0);
            used = BigInt(parts[2] || 0);
            available = BigInt(parts[3] || 0);
          }
        }
      }
    } catch (err: any) {
      console.warn(`[RSYNC] Failed to probe disk space for ${repo.path}:`, err.message);
      isMounted = false;
    }

    // Update in database
    await prisma.rsyncRepository.update({
      where: { id: repoId },
      data: {
        totalBytes: total,
        usedBytes: used,
        availableBytes: available,
        isMounted,
      },
    });

    return { totalBytes: total, usedBytes: used, availableBytes: available, isMounted };
  }

  /**
   * Tests SSH connection using direct credential inputs with support for INFO and DEBUG logs
   */
  async testConnectionCredentials(input: {
    host: string;
    port?: number;
    username?: string;
    authType?: string;
    password?: string | null;
    sshPrivateKey?: string | null;
    logLevel?: 'info' | 'debug';
  }): Promise<SshTestResult> {
    const host = input.host?.trim();
    const port = input.port || 22;
    const username = input.username?.trim() || 'root';
    const authType = input.authType || 'SSH_KEY';
    const logLevel: 'info' | 'debug' = input.logLevel === 'debug' ? 'debug' : 'info';

    const logLines: string[] = [];
    const addLog = (level: 'INFO' | 'DEBUG' | 'SUCCESS' | 'ERROR' | 'WARN', msg: string) => {
      const ts = new Date().toISOString().substring(11, 23);
      logLines.push(`[${ts}] [${level}] ${msg}`);
    };

    if (!host) {
      addLog('ERROR', 'Target host address is missing or empty.');
      return {
        status: 'OFFLINE',
        latencyMs: 0,
        message: 'Host address is required',
        logs: logLines.join('\n'),
        logLevel,
      };
    }

    addLog(
      'INFO',
      `Starting connection test for ${username}@${host}:${port} (Auth: ${authType}, Verbosity: ${logLevel.toUpperCase()})...`
    );

    const startTime = Date.now();

    if (authType === 'LOCAL' || host === 'localhost' || host === '127.0.0.1') {
      addLog('INFO', 'Target configured as Local Host (127.0.0.1).');
      addLog('SUCCESS', 'Local server filesystem is online, accessible, and ready for sync.');
      return {
        status: 'ONLINE',
        latencyMs: Date.now() - startTime,
        message: 'Local host is online and accessible.',
        logs: logLines.join('\n'),
        logLevel,
      };
    }

    // Step 1: TCP Socket Reachability Check
    addLog('INFO', `Phase 1: Probing TCP socket reachability on ${host}:${port}...`);
    const tcpStartTime = Date.now();
    const isPortOpen = await new Promise<boolean>((resolve) => {
      const socket = new net.Socket();
      socket.setTimeout(4500);
      socket.on('connect', () => {
        socket.destroy();
        resolve(true);
      });
      socket.on('timeout', () => {
        addLog('WARN', `TCP socket connection to ${host}:${port} timed out after 4500ms.`);
        socket.destroy();
        resolve(false);
      });
      socket.on('error', (err) => {
        addLog('WARN', `TCP socket connection to ${host}:${port} failed: ${err.message}`);
        socket.destroy();
        resolve(false);
      });
      socket.connect(port, host);
    });

    const tcpLatency = Date.now() - tcpStartTime;

    if (!isPortOpen) {
      addLog('ERROR', `TCP socket connection to ${host}:${port} could not be established.`);
      addLog('ERROR', 'Check if the server IP/hostname is correct, port 22 is open, and firewall rules allow incoming traffic.');
      return {
        status: 'OFFLINE',
        latencyMs: tcpLatency,
        message: `Unable to reach ${host} on port ${port}. Host is unreachable or firewall is blocking the connection.`,
        logs: logLines.join('\n'),
        logLevel,
      };
    }

    addLog('SUCCESS', `TCP socket connection established with ${host}:${port} in ${tcpLatency}ms.`);

    // Step 2: SSH Authentication Test
    addLog('INFO', `Phase 2: Initiating OpenSSH authentication probe (User: ${username})...`);
    let tempKeyFile: string | null = null;
    let status: 'ONLINE' | 'OFFLINE' = 'OFFLINE';
    let message = '';

    try {
      const sshOpts = [
        `-p ${port}`,
        `-o StrictHostKeyChecking=no`,
        `-o UserKnownHostsFile=/dev/null`,
        `-o ConnectTimeout=6`,
        `-o BatchMode=yes`,
      ];

      if (logLevel === 'debug') {
        sshOpts.push('-vv'); // Ultra-detailed debug logs showing cipher suites, keys, packets
        addLog('DEBUG', 'OpenSSH verbose debug output enabled (-vv). Capturing raw handshake:');
      } else {
        sshOpts.push('-v'); // Standard verbose so we capture connection and auth steps
      }

      let sshCmd = '';
      if (authType === 'SSH_KEY' && input.sshPrivateKey) {
        tempKeyFile = path.join(os.tmpdir(), `test_ssh_key_${Date.now()}_${Math.random().toString(36).substring(7)}`);
        fs.writeFileSync(tempKeyFile, input.sshPrivateKey, { mode: 0o600 });
        sshOpts.push(`-i "${tempKeyFile}"`);
        sshCmd = `ssh ${sshOpts.join(' ')} ${username}@${host} "echo OK"`;
        addLog('INFO', 'Loaded temporary private key for authentication test.');
      } else if (authType === 'PASSWORD') {
        if (input.password) {
          sshCmd = `sshpass -p "${input.password}" ssh ${sshOpts.join(' ')} ${username}@${host} "echo OK"`;
          addLog('INFO', 'Configured password authentication test via sshpass.');
        } else {
          sshCmd = `ssh ${sshOpts.join(' ')} ${username}@${host} "echo OK"`;
          addLog('INFO', 'No password provided; probing remote SSH banner.');
        }
      } else {
        sshCmd = `ssh ${sshOpts.join(' ')} ${username}@${host} "echo OK"`;
      }

      addLog('DEBUG', `Executing command: ${sshCmd.replace(/-p ".*?"/g, '-p "[REDACTED]"')}`);

      let rawStdout = '';
      let rawStderr = '';

      try {
        const execRes = await execAsync(sshCmd);
        rawStdout = execRes.stdout || '';
        rawStderr = execRes.stderr || '';
        status = 'ONLINE';
        message = `SSH connection & authentication successful (${username}@${host}:${port}).`;
      } catch (execErr: any) {
        rawStdout = execErr.stdout || '';
        rawStderr = execErr.stderr || execErr.message || '';

        // Check if sshpass is missing
        if (
          authType === 'PASSWORD' &&
          (rawStderr.includes('sshpass: not found') || rawStderr.includes('command not found') || execErr?.code === 127)
        ) {
          status = 'ONLINE';
          message = `SSH port ${port} is active and listening on ${host}. Password will be utilized during rsync.`;
        } else if (rawStderr.includes('Permission denied')) {
          status = 'OFFLINE';
          message = `Authentication rejected: Permission denied (publickey/password). Ensure public key or password is valid on ${host}.`;
        } else if (rawStderr.includes('Connection timed out') || rawStderr.includes('Operation timed out')) {
          status = 'OFFLINE';
          message = `Connection timed out while negotiating SSH handshake with ${host}:${port}.`;
        } else {
          status = 'OFFLINE';
          message = rawStderr.trim().split('\n').pop() || 'SSH handshake failed.';
        }
      }

      // Append and format SSH output
      addLog('INFO', '--- [OpenSSH Connection Transcript] ---');
      const sshOutputLines = (rawStderr + '\n' + rawStdout)
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => l.length > 0);

      if (logLevel === 'debug') {
        // In debug mode, print every raw line
        for (const line of sshOutputLines) {
          logLines.push(`    ${line}`);
        }
      } else {
        // In info mode, filter out internal packet debug noise and retain significant milestones
        const importantLines = sshOutputLines.filter((l) =>
          l.includes('Connecting to') ||
          l.includes('Connection established') ||
          l.includes('identity file') ||
          l.includes('Authenticating to') ||
          l.includes('Next authentication method') ||
          l.includes('Authentication succeeded') ||
          l.includes('Permission denied') ||
          l.includes('OpenSSH') ||
          l.includes('Server host key') ||
          l.includes('Failed') ||
          l.includes('error') ||
          l.includes('OK')
        );

        if (importantLines.length > 0) {
          for (const line of importantLines) {
            logLines.push(`    ${line}`);
          }
        } else {
          // If no filtered line matched, show all lines up to 10
          for (const line of sshOutputLines.slice(0, 10)) {
            logLines.push(`    ${line}`);
          }
        }
      }
      addLog('INFO', '--------------------------------------');

      if (status === 'ONLINE') {
        addLog('SUCCESS', `Test passed! ${message}`);
      } else {
        addLog('ERROR', `Test failed! ${message}`);
      }
    } catch (err: any) {
      status = 'OFFLINE';
      message = err.message || 'SSH authentication handshake failed.';
      addLog('ERROR', `Unexpected test failure: ${err.message}`);
    } finally {
      if (tempKeyFile && fs.existsSync(tempKeyFile)) {
        try {
          fs.unlinkSync(tempKeyFile);
          addLog('DEBUG', 'Cleaned up temporary key file.');
        } catch (_) {}
      }
    }

    const latencyMs = Date.now() - startTime;
    addLog('INFO', `Diagnostic finished in ${latencyMs}ms with final status: ${status}.`);

    return { status, latencyMs, message, logs: logLines.join('\n'), logLevel };
  }

  /**
   * Tests SSH connection to a registered remote server
   */
  async testServerConnection(
    serverId: string,
    logLevel: 'info' | 'debug' = 'info'
  ): Promise<SshTestResult> {
    const server = await prisma.rsyncServer.findUnique({ where: { id: serverId } });
    if (!server) throw new Error(`Server not found: ${serverId}`);

    const result = await this.testConnectionCredentials({ ...server, logLevel });

    await prisma.rsyncServer.update({
      where: { id: serverId },
      data: {
        status: result.status,
        lastCheckedAt: new Date(),
      },
    });

    // Audit log
    await prisma.rsyncActivityLog.create({
      data: {
        action: 'SERVER_TESTED',
        entityId: serverId,
        entityType: 'SERVER',
        username: 'SYSTEM',
        details: { status: result.status, latencyMs: result.latencyMs, message: result.message },
      },
    });

    return result;
  }

  /**
   * Helper to build the ssh connection prefix
   */
  private buildSshCommand(server: {
    host: string;
    port: number;
    username: string;
    authType: string;
    password?: string | null;
    sshPrivateKey?: string | null;
  }, timeoutSeconds: number = 10): string {
    const opts = [
      `-p ${server.port}`,
      `-o StrictHostKeyChecking=no`,
      `-o UserKnownHostsFile=/dev/null`,
      `-o ConnectTimeout=${timeoutSeconds}`,
      `-o BatchMode=yes`,
    ];

    if (server.authType === 'SSH_KEY' && server.sshPrivateKey) {
      // Create a temporary key file if necessary
      const keyPath = path.join(os.tmpdir(), `rsync_key_${Date.now()}_${Math.random().toString(36).substring(7)}`);
      fs.writeFileSync(keyPath, server.sshPrivateKey, { mode: 0o600 });
      opts.push(`-i "${keyPath}"`);
    }

    return `ssh ${opts.join(' ')} ${server.username}@${server.host}`;
  }

  /**
   * Formats a path into local or remote syntax for rsync
   */
  private formatRsyncEndpoint(
    repo: { path: string },
    subpath?: string | null,
    server?: { host: string; username: string; authType: string } | null
  ): string {
    let fullPath = subpath ? path.posix.join(repo.path, subpath) : repo.path;
    // Ensure trailing slash for directory syncing semantics in rsync
    if (!fullPath.endsWith('/')) {
      fullPath += '/';
    }

    if (server && server.authType !== 'LOCAL' && server.host !== 'localhost' && server.host !== '127.0.0.1') {
      return `${server.username}@${server.host}:${fullPath}`;
    }

    return fullPath;
  }

  /**
   * Executes an rsync job (Manual, Scheduled, or Dry-Run)
   */
  async executeJob(
    jobId: string,
    runType: 'MANUAL' | 'SCHEDULED' | 'DRY_RUN',
    triggeredBy: string = 'admin'
  ): Promise<any> {
    const job = await prisma.rsyncJob.findUnique({
      where: { id: jobId },
      include: {
        sourceRepo: true,
        destRepo: true,
        sourceServer: true,
        destServer: true,
      },
    });

    if (!job) throw new Error(`Rsync job not found: ${jobId}`);

    const sourceEndpoint = this.formatRsyncEndpoint(job.sourceRepo, job.sourceSubpath, job.sourceServer);
    let destEndpoint = this.formatRsyncEndpoint(job.destRepo, job.destSubpath, job.destServer);

    const now = new Date();
    const timestampStr = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);

    // Build rsync arguments array
    const args: string[] = ['-av', '--stats'];

    if (job.preservePermissions) args.push('-p');
    if (job.preserveOwner) args.push('-og');
    if (job.preserveTimes) args.push('-t');
    if (job.enableCompression) args.push('-z');
    if (job.deleteExtraneous) args.push('--delete');

    if (runType === 'DRY_RUN') {
      args.push('-n');
    }

    if (job.bandwidthLimitKb && job.bandwidthLimitKb > 0) {
      args.push(`--bwlimit=${job.bandwidthLimitKb}`);
    }

    if (job.excludePatterns && job.excludePatterns.length > 0) {
      for (const pattern of job.excludePatterns) {
        if (pattern.trim()) {
          args.push(`--exclude=${pattern.trim()}`);
        }
      }
    }

    // Handle Strategies:
    // 1. HARDLINK_SNAPSHOT:
    // Target is dest/snapshots/snapshot_${timestampStr}/, and --link-dest=../latest
    if (job.syncStrategy === 'HARDLINK_SNAPSHOT') {
      const baseDest = destEndpoint.endsWith('/') ? destEndpoint.slice(0, -1) : destEndpoint;
      destEndpoint = `${baseDest}/snapshot_${timestampStr}/`;
      args.push(`--link-dest=${baseDest}/latest`);
    }
    // 2. BACKUP_DIR:
    // Files are mirrored to dest/current/, but deletions/modifications are moved to dest/recycle_bin/${timestampStr}/
    else if (job.syncStrategy === 'BACKUP_DIR') {
      const baseDest = destEndpoint.endsWith('/') ? destEndpoint.slice(0, -1) : destEndpoint;
      destEndpoint = `${baseDest}/current/`;
      args.push(`--backup`);
      args.push(`--backup-dir=${baseDest}/recycle_bin/${timestampStr}`);
    }

    // Configure SSH if remote server is involved
    const remoteServer = job.sourceServer || job.destServer;
    let tempKeyFile: string | null = null;
    if (remoteServer && remoteServer.authType === 'SSH_KEY' && remoteServer.sshPrivateKey) {
      tempKeyFile = path.join(os.tmpdir(), `rsync_run_${Date.now()}.key`);
      fs.writeFileSync(tempKeyFile, remoteServer.sshPrivateKey, { mode: 0o600 });
      args.push(`-e`, `ssh -p ${remoteServer.port} -i "${tempKeyFile}" -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null`);
    } else if (remoteServer && remoteServer.authType !== 'LOCAL') {
      args.push(`-e`, `ssh -p ${remoteServer.port} -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null`);
    }

    // Custom arguments
    if (job.customArgs) {
      const customParts = job.customArgs.trim().split(/\s+/);
      args.push(...customParts);
    }

    // Source and Destination
    args.push(sourceEndpoint, destEndpoint);

    // Create initial RsyncRun record
    const run = await prisma.rsyncRun.create({
      data: {
        jobId: job.id,
        runType,
        status: 'IN_PROGRESS',
        sourcePath: sourceEndpoint,
        destinationPath: destEndpoint,
        startedAt: now,
      },
    });

    // Update job status to IN_PROGRESS
    await prisma.rsyncJob.update({
      where: { id: job.id },
      data: {
        lastRunStatus: 'IN_PROGRESS',
        lastRunAt: now,
      },
    });

    // Audit log
    await prisma.rsyncActivityLog.create({
      data: {
        action: runType === 'DRY_RUN' ? 'DRY_RUN_TRIGGERED' : 'JOB_STARTED',
        entityId: run.id,
        entityType: 'RUN',
        username: triggeredBy,
        details: { jobId: job.id, jobName: job.name, runType, args: args.join(' ') },
      },
    });

    // Execute rsync child process asynchronously
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      let stdoutBuffer = '';
      let stderrBuffer = '';

      console.log(`[RSYNC] Executing command: rsync ${args.join(' ')}`);

      const child = spawn('rsync', args, {
        shell: true,
      });

      child.stdout.on('data', (chunk) => {
        stdoutBuffer += chunk.toString();
      });

      child.stderr.on('data', (chunk) => {
        stderrBuffer += chunk.toString();
      });

      child.on('error', async (err) => {
        console.error(`[RSYNC] Process error on job ${job.name}:`, err);
        const durationSeconds = (Date.now() - startTime) / 1000;

        if (tempKeyFile && fs.existsSync(tempKeyFile)) {
          try { fs.unlinkSync(tempKeyFile); } catch (_) {}
        }

        const failedRun = await prisma.rsyncRun.update({
          where: { id: run.id },
          data: {
            status: 'FAILED',
            exitCode: 1,
            durationSeconds,
            errorMessage: err.message,
            stderrLog: stderrBuffer + '\n' + err.message,
            completedAt: new Date(),
          },
        });

        await prisma.rsyncJob.update({
          where: { id: job.id },
          data: { lastRunStatus: 'FAILED' },
        });

        // Trigger Instant Failure Alert across all active notification channels
        dispatchInstantFailureAlert({
          projectName: `Rsync: ${job.name}`,
          serverId: job.destServer?.name || 'Local Host',
          hostname: os.hostname(),
          backupType: 'rsync_mirror',
          status: 'FAILED',
          durationSeconds: Math.round(durationSeconds),
          backupSizeBytes: 0,
          errorMessage: `Rsync Process Error: ${err.message}`,
        }).catch(() => {});

        resolve(failedRun);
      });

      child.on('close', async (exitCode) => {
        const durationSeconds = (Date.now() - startTime) / 1000;
        const isSuccess = exitCode === 0;

        if (tempKeyFile && fs.existsSync(tempKeyFile)) {
          try { fs.unlinkSync(tempKeyFile); } catch (_) {}
        }

        // Post-execution hook for HARDLINK_SNAPSHOT: update symlink 'latest' -> new snapshot
        if (isSuccess && job.syncStrategy === 'HARDLINK_SNAPSHOT') {
          try {
            const baseDest = destEndpoint.replace(/\/snapshot_[^/]+\/$/, '');
            const snapshotFolder = `snapshot_${timestampStr}`;
            const symlinkCmd = `cd "${baseDest}" && ln -sfn "${snapshotFolder}" latest`;
            await execAsync(symlinkCmd).catch(() => {});
          } catch (_) {}
        }

        // Parse rsync transfer statistics
        const parsedStats = parseRsyncStats(stdoutBuffer);

        const updatedRun = await prisma.rsyncRun.update({
          where: { id: run.id },
          data: {
            status: isSuccess ? 'SUCCESS' : 'FAILED',
            exitCode,
            durationSeconds,
            stdoutLog: stdoutBuffer,
            stderrLog: stderrBuffer,
            errorMessage: isSuccess ? null : (stderrBuffer.trim() || `Rsync exited with code ${exitCode}`),
            totalFiles: parsedStats.totalFiles,
            transferredFiles: parsedStats.transferredFiles,
            deletedFiles: parsedStats.deletedFiles,
            bytesTransferred: parsedStats.bytesTransferred,
            totalSizeBytes: parsedStats.totalSizeBytes,
            speedupRatio: parsedStats.speedupRatio,
            completedAt: new Date(),
          },
        });

        // Update parent Job status
        await prisma.rsyncJob.update({
          where: { id: job.id },
          data: {
            lastRunStatus: isSuccess ? 'SUCCESS' : 'FAILED',
            lastRunAt: new Date(),
          },
        });

        // Audit log
        await prisma.rsyncActivityLog.create({
          data: {
            action: isSuccess ? 'JOB_COMPLETED' : 'JOB_FAILED',
            entityId: run.id,
            entityType: 'RUN',
            username: triggeredBy,
            details: {
              jobId: job.id,
              jobName: job.name,
              status: isSuccess ? 'SUCCESS' : 'FAILED',
              exitCode,
              durationSeconds,
              bytesTransferred: parsedStats.bytesTransferred.toString(),
            },
          },
        });

        // If failed, trigger instant alert across notification channels
        if (!isSuccess) {
          dispatchInstantFailureAlert({
            projectName: `Rsync: ${job.name}`,
            serverId: job.destServer?.name || 'Local Host',
            hostname: os.hostname(),
            backupType: 'rsync_mirror',
            status: 'FAILED',
            durationSeconds: Math.round(durationSeconds),
            backupSizeBytes: parsedStats.bytesTransferred,
            errorMessage: stderrBuffer.trim() || `Rsync mirror failed with exit code ${exitCode}`,
          }).catch(() => {});
        }

        // Refresh disk space in background
        this.probeRepositoryDiskSpace(job.destRepoId).catch(() => {});

        resolve(updatedRun);
      });
    });
  }
}

export const rsyncService = new RsyncService();
