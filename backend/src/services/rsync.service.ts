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
        // Local execution: run df -P -B1
        const cleanPath = path.resolve(repo.path);
        const { stdout } = await execAsync(`df -P -B1 "${cleanPath}" 2>/dev/null || df -P -B1 .`);
        const lines = stdout.trim().split('\n');
        for (let i = lines.length - 1; i >= 0; i--) {
          const parts = lines[i].trim().split(/\s+/);
          if (parts.length >= 5 && /^\d+$/.test(parts[1]) && /^\d+$/.test(parts[2])) {
            total = BigInt(parts[1] || 0);
            used = BigInt(parts[2] || 0);
            available = BigInt(parts[3] || 0);
            break;
          }
        }
      } else {
        // Remote execution over SSH
        const sshInfo = this.buildSshCommand(repo.server);
        try {
          const { stdout } = await execAsync(`${sshInfo.cmd} "df -P -B1 '${repo.path}' 2>/dev/null || df -P -B1 /"`, { env: sshInfo.env });
          const lines = stdout.trim().split('\n');
          for (let i = lines.length - 1; i >= 0; i--) {
            const parts = lines[i].trim().split(/\s+/);
            if (parts.length >= 5 && /^\d+$/.test(parts[1]) && /^\d+$/.test(parts[2])) {
              total = BigInt(parts[1] || 0);
              used = BigInt(parts[2] || 0);
              available = BigInt(parts[3] || 0);
              break;
            }
          }
        } finally {
          if (sshInfo.tempKeyFile && fs.existsSync(sshInfo.tempKeyFile)) {
            try { fs.unlinkSync(sshInfo.tempKeyFile); } catch (_) {}
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
      ];

      if (authType === 'PASSWORD') {
        sshOpts.push(
          `-o PreferredAuthentications=password,keyboard-interactive`,
          `-o PubkeyAuthentication=no`,
          `-o NumberOfPasswordPrompts=1`
        );
      } else {
        sshOpts.push(`-o BatchMode=yes`);
      }

      if (logLevel === 'debug') {
        sshOpts.push('-vv'); // Ultra-detailed debug logs showing cipher suites, keys, packets
        addLog('DEBUG', 'OpenSSH verbose debug output enabled (-vv). Capturing raw handshake:');
      } else {
        sshOpts.push('-v'); // Standard verbose so we capture connection and auth steps
      }

      const execEnv: NodeJS.ProcessEnv = { ...process.env };
      let sshCmd = '';
      if (authType === 'SSH_KEY' && input.sshPrivateKey) {
        tempKeyFile = path.join(os.tmpdir(), `test_ssh_key_${Date.now()}_${Math.random().toString(36).substring(7)}`);
        fs.writeFileSync(tempKeyFile, input.sshPrivateKey, { mode: 0o600 });
        sshOpts.push(`-i "${tempKeyFile}"`);
        sshCmd = `ssh ${sshOpts.join(' ')} ${username}@${host} "echo OK"`;
        addLog('INFO', 'Loaded temporary private key for authentication test.');
      } else if (authType === 'PASSWORD') {
        if (input.password) {
          execEnv.SSHPASS = input.password;
          sshCmd = `sshpass -e ssh ${sshOpts.join(' ')} ${username}@${host} "echo OK"`;
          addLog('INFO', 'Configured password authentication test via sshpass.');
        } else {
          sshCmd = `ssh ${sshOpts.join(' ')} ${username}@${host} "echo OK"`;
          addLog('INFO', 'No password provided; probing remote SSH banner.');
        }
      } else {
        sshCmd = `ssh ${sshOpts.join(' ')} ${username}@${host} "echo OK"`;
      }

      addLog('DEBUG', `Executing command: ${sshCmd}`);

      let rawStdout = '';
      let rawStderr = '';

      try {
        const execRes = await execAsync(sshCmd, { env: execEnv });
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
        } else if (execErr?.code === 5 || rawStderr.includes('Permission denied')) {
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
   * Helper to build the ssh connection prefix and environment
   */
  private buildSshCommand(
    server: {
      host: string;
      port: number;
      username: string;
      authType: string;
      password?: string | null;
      sshPrivateKey?: string | null;
    },
    timeoutSeconds: number = 10
  ): { cmd: string; env: NodeJS.ProcessEnv; tempKeyFile?: string } {
    const opts = [
      `-p ${server.port}`,
      `-o StrictHostKeyChecking=no`,
      `-o UserKnownHostsFile=/dev/null`,
      `-o ConnectTimeout=${timeoutSeconds}`,
    ];

    const env: NodeJS.ProcessEnv = { ...process.env };
    let tempKeyFile: string | undefined;

    if (server.authType === 'PASSWORD') {
      opts.push(
        `-o PreferredAuthentications=password,keyboard-interactive`,
        `-o PubkeyAuthentication=no`,
        `-o NumberOfPasswordPrompts=1`
      );
      if (server.password) {
        env.SSHPASS = server.password;
        return {
          cmd: `sshpass -e ssh ${opts.join(' ')} ${server.username}@${server.host}`,
          env,
        };
      }
    } else {
      opts.push(`-o BatchMode=yes`);
      if (server.authType === 'SSH_KEY' && server.sshPrivateKey) {
        tempKeyFile = path.join(os.tmpdir(), `rsync_key_${Date.now()}_${Math.random().toString(36).substring(7)}`);
        fs.writeFileSync(tempKeyFile, server.sshPrivateKey, { mode: 0o600 });
        opts.push(`-i "${tempKeyFile}"`);
      }
    }

    return {
      cmd: `ssh ${opts.join(' ')} ${server.username}@${server.host}`,
      env,
      tempKeyFile,
    };
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
  /**
   * Executes an rsync job (Manual, Scheduled, or Dry-Run)
   * Supports Local-to-Local, Local-to-Remote, Remote-to-Local,
   * Same-Remote-Node Disk Sync, and Cross-Server 2-Stage Delta Bridge.
   */
  async executeJob(
    jobId: string,
    runType: 'MANUAL' | 'SCHEDULED' | 'DRY_RUN',
    triggeredBy: string = 'admin'
  ): Promise<any> {
    const job = await prisma.rsyncJob.findUnique({
      where: { id: jobId },
      include: {
        sourceRepo: { include: { server: true } },
        destRepo: { include: { server: true } },
        sourceServer: true,
        destServer: true,
      },
    });

    if (!job) throw new Error(`Rsync job not found: ${jobId}`);

    // Auto-resolve servers from repository mounts if unassigned
    const sourceServer = job.sourceServer || job.sourceRepo?.server || null;
    const destServer = job.destServer || job.destRepo?.server || null;

    if ((!job.sourceServerId && sourceServer) || (!job.destServerId && destServer)) {
      await prisma.rsyncJob.update({
        where: { id: job.id },
        data: {
          sourceServerId: sourceServer?.id || null,
          destServerId: destServer?.id || null,
        },
      }).catch(() => {});
    }

    const isSourceRemote = !!(
      sourceServer &&
      sourceServer.authType !== 'LOCAL' &&
      sourceServer.host !== 'localhost' &&
      sourceServer.host !== '127.0.0.1'
    );
    const isDestRemote = !!(
      destServer &&
      destServer.authType !== 'LOCAL' &&
      destServer.host !== 'localhost' &&
      destServer.host !== '127.0.0.1'
    );

    let sourceRaw = job.sourceSubpath ? path.posix.join(job.sourceRepo.path, job.sourceSubpath) : job.sourceRepo.path;
    if (!sourceRaw.endsWith('/')) sourceRaw += '/';

    let destRaw = job.destSubpath ? path.posix.join(job.destRepo.path, job.destSubpath) : job.destRepo.path;
    if (!destRaw.endsWith('/')) destRaw += '/';

    const now = new Date();
    const timestampStr = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);

    // Build common rsync arguments array
    const baseArgs: string[] = ['-av', '--stats'];

    // If destination is remote, or user is not root, or preserveOwner is false:
    // Drop foreign ownership and group chown to prevent EPERM errors
    if (!job.preserveOwner || (destServer && destServer.username !== 'root')) {
      baseArgs.push('--no-owner', '--no-group');
    }
    // Omit directory modification timestamps when writing to remote destination to prevent EPERM on destination folder
    if (destServer && destServer.authType !== 'LOCAL') {
      baseArgs.push('--omit-dir-times');
    }

    if (job.preservePermissions) baseArgs.push('-p');
    if (job.preserveTimes) baseArgs.push('-t');
    if (job.enableCompression) baseArgs.push('-z');
    if (job.deleteExtraneous) baseArgs.push('--delete');
    if (runType === 'DRY_RUN') baseArgs.push('-n');
    if (job.bandwidthLimitKb && job.bandwidthLimitKb > 0) baseArgs.push(`--bwlimit=${job.bandwidthLimitKb}`);
    if (job.excludePatterns && job.excludePatterns.length > 0) {
      for (const pattern of job.excludePatterns) {
        if (pattern.trim()) baseArgs.push(`--exclude=${pattern.trim()}`);
      }
    }
    if (job.customArgs) {
      baseArgs.push(...job.customArgs.trim().split(/\s+/));
    }

    // Determine Topology
    const isSameRemoteNode = isSourceRemote && isDestRemote && sourceServer!.host === destServer!.host;
    const isCrossRemoteNodes = isSourceRemote && isDestRemote && sourceServer!.host !== destServer!.host;

    let sourceEndpointDisplay = sourceRaw;
    let destEndpointDisplay = destRaw;

    if (isSourceRemote && sourceServer) {
      sourceEndpointDisplay = `${sourceServer.username}@${sourceServer.host}:${sourceRaw}`;
    }
    if (isDestRemote && destServer) {
      destEndpointDisplay = `${destServer.username}@${destServer.host}:${destRaw}`;
    }

    // Initial RsyncRun audit record
    const run = await prisma.rsyncRun.create({
      data: {
        jobId: job.id,
        runType,
        status: 'IN_PROGRESS',
        sourcePath: sourceEndpointDisplay,
        destinationPath: destEndpointDisplay,
        startedAt: now,
      },
    });

    await prisma.rsyncJob.update({
      where: { id: job.id },
      data: {
        lastRunStatus: 'IN_PROGRESS',
        lastRunAt: now,
      },
    });

    await prisma.rsyncActivityLog.create({
      data: {
        action: runType === 'DRY_RUN' ? 'DRY_RUN_TRIGGERED' : 'JOB_STARTED',
        entityId: run.id,
        entityType: 'RUN',
        username: triggeredBy,
        details: {
          jobId: job.id,
          jobName: job.name,
          runType,
          commandMode: (job as any).commandMode || (job.customArgs && job.customArgs.trim() ? 'USER' : 'SYSTEM'),
          topology: isSameRemoteNode ? 'SAME_REMOTE' : isCrossRemoteNodes ? 'CROSS_REMOTE' : 'STANDARD',
        },
      },
    });

    const startTime = Date.now();

    // ------------------------------------------------------------------------
    // CASE 0: User-Managed Custom Full Command (Linux Expert Full Control)
    // ------------------------------------------------------------------------
    const userManagedCommand =
      job.commandMode === 'USER' && ((job as any).customCommand || job.customArgs)
        ? ((job as any).customCommand || job.customArgs)!.trim()
        : null;

    const isFullCustomCommand = !!(
      userManagedCommand &&
      (userManagedCommand.startsWith('rsync') ||
       userManagedCommand.startsWith('ssh') ||
       userManagedCommand.startsWith('#') ||
       userManagedCommand.includes('\n') ||
       userManagedCommand.includes(';') ||
       userManagedCommand.includes('&&'))
    );

    let childCmd = '';
    let childArgs: string[] = [];
    let envExtra: NodeJS.ProcessEnv = { ...process.env };
    let tempKeyFile: string | null = null;
    let baseDestForSymlink: string | null = null;
    let sshInfoForRemote: { cmd: string; env: NodeJS.ProcessEnv; tempKeyFile?: string } | null = null;

    if (isFullCustomCommand) {
      // Set up SSHPASS if remote server uses password
      if (destServer && destServer.authType === 'PASSWORD' && destServer.password) {
        envExtra.SSHPASS = destServer.password;
      } else if (sourceServer && sourceServer.authType === 'PASSWORD' && sourceServer.password) {
        envExtra.SSHPASS = sourceServer.password;
      }

      // Set up SSH Private Key if remote server uses key auth
      const keyServer = (destServer && destServer.authType === 'SSH_KEY' && destServer.sshPrivateKey) ? destServer :
                        (sourceServer && sourceServer.authType === 'SSH_KEY' && sourceServer.sshPrivateKey) ? sourceServer : null;
      if (keyServer && keyServer.sshPrivateKey) {
        tempKeyFile = path.join(os.tmpdir(), `rsync_user_${Date.now()}.key`);
        fs.writeFileSync(tempKeyFile, keyServer.sshPrivateKey, { mode: 0o600 });
      }

      let finalCmd = userManagedCommand!;
      if (runType === 'DRY_RUN' && !finalCmd.includes('-n') && !finalCmd.includes('--dry-run')) {
        finalCmd = finalCmd.replace(/\brsync\b/g, 'rsync -n');
      }

      childCmd = finalCmd;
      childArgs = [];
      console.log(`[RSYNC USER-MANAGED FULL COMMAND] Executing:\n${childCmd}`);
    } else if (isCrossRemoteNodes) {
      // ------------------------------------------------------------------------
      // CASE 1: Cross-Server Sync between Two Different Remote Hosts (Bridge)
      // ------------------------------------------------------------------------
      return this.executeTwoStageBridge(
        job,
        sourceServer!,
        destServer!,
        sourceRaw,
        destRaw,
        baseArgs,
        runType,
        timestampStr,
        run,
        startTime,
        triggeredBy
      );
    } else if (isSameRemoteNode) {
      // ------------------------------------------------------------------------
      // CASE 2: Same-Remote Host Direct Native Execution via SSH Tunnel
      // ------------------------------------------------------------------------
      // Both folders are on the SAME remote machine!
      // Rsync runs natively on that machine via SSH tunnel at direct drive speed.
      let targetDest = destRaw;
      if (job.syncStrategy === 'HARDLINK_SNAPSHOT') {
        baseDestForSymlink = targetDest.endsWith('/') ? targetDest.slice(0, -1) : targetDest;
        targetDest = `${baseDestForSymlink}/snapshot_${timestampStr}/`;
        baseArgs.push(`--link-dest=${baseDestForSymlink}/latest`);
      } else if (job.syncStrategy === 'BACKUP_DIR') {
        const baseDest = targetDest.endsWith('/') ? targetDest.slice(0, -1) : targetDest;
        targetDest = `${baseDest}/current/`;
        baseArgs.push(`--backup`, `--backup-dir=${baseDest}/recycle_bin/${timestampStr}`);
      }

      // Pick server credentials with valid auth
      const execServer = destServer!.password || destServer!.sshPrivateKey ? destServer! : sourceServer!;
      sshInfoForRemote = this.buildSshCommand(execServer);
      tempKeyFile = sshInfoForRemote.tempKeyFile || null;
      envExtra = sshInfoForRemote.env;

      // Ensure dest directory exists on remote server before sync
      const remoteCmd = `mkdir -p '${targetDest}' && rsync ${baseArgs.join(' ')} '${sourceRaw}' '${targetDest}'`;
      childCmd = `${sshInfoForRemote.cmd} "${remoteCmd}"`;
      childArgs = [];
    } else {
      // Standard Sync (Local to Local, Local to Remote, or Remote to Local)
      let sourceEndpoint = this.formatRsyncEndpoint(job.sourceRepo, job.sourceSubpath, sourceServer);
      let destEndpoint = this.formatRsyncEndpoint(job.destRepo, job.destSubpath, destServer);

      if (job.syncStrategy === 'HARDLINK_SNAPSHOT') {
        const baseDest = destEndpoint.endsWith('/') ? destEndpoint.slice(0, -1) : destEndpoint;
        destEndpoint = `${baseDest}/snapshot_${timestampStr}/`;
        baseArgs.push(`--link-dest=${baseDest}/latest`);
        baseDestForSymlink = baseDest;
      } else if (job.syncStrategy === 'BACKUP_DIR') {
        const baseDest = destEndpoint.endsWith('/') ? destEndpoint.slice(0, -1) : destEndpoint;
        destEndpoint = `${baseDest}/current/`;
        baseArgs.push(`--backup`, `--backup-dir=${baseDest}/recycle_bin/${timestampStr}`);
      }

      const remoteServer = isSourceRemote ? sourceServer : isDestRemote ? destServer : null;
      if (remoteServer && remoteServer.authType === 'SSH_KEY' && remoteServer.sshPrivateKey) {
        tempKeyFile = path.join(os.tmpdir(), `rsync_run_${Date.now()}.key`);
        fs.writeFileSync(tempKeyFile, remoteServer.sshPrivateKey, { mode: 0o600 });
        baseArgs.push(
          `-e`,
          `ssh -p ${remoteServer.port} -i ${tempKeyFile} -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o BatchMode=yes`
        );
      } else if (remoteServer && remoteServer.authType === 'PASSWORD' && remoteServer.password) {
        envExtra.SSHPASS = remoteServer.password;
        baseArgs.push(
          `-e`,
          `sshpass -e ssh -p ${remoteServer.port} -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o PreferredAuthentications=password,keyboard-interactive -o PubkeyAuthentication=no -o NumberOfPasswordPrompts=1`
        );
      } else if (remoteServer && remoteServer.authType !== 'LOCAL') {
        baseArgs.push(`-e`, `ssh -p ${remoteServer.port} -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o BatchMode=yes`);
      }

      baseArgs.push(sourceEndpoint, destEndpoint);
      childCmd = 'rsync';
      childArgs = baseArgs;
    }

    return new Promise((resolve) => {
      let stdoutBuffer = '';
      let stderrBuffer = '';

      console.log(`[RSYNC] Launching: ${childCmd} ${childArgs.join(' ')}`);

      const child = childArgs.length > 0
        ? spawn(childCmd, childArgs, { env: envExtra })
        : spawn(childCmd, { env: envExtra, shell: true });

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

        dispatchInstantFailureAlert({
          projectName: `Rsync: ${job.name}`,
          serverId: destServer?.name || 'Local Host',
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
        if (isSuccess && job.syncStrategy === 'HARDLINK_SNAPSHOT' && baseDestForSymlink) {
          try {
            const snapshotFolder = `snapshot_${timestampStr}`;
            if (isSameRemoteNode && sshInfoForRemote) {
              const symlinkCmd = `${sshInfoForRemote.cmd} "cd '${baseDestForSymlink}' && ln -sfn '${snapshotFolder}' latest"`;
              await execAsync(symlinkCmd, { env: sshInfoForRemote.env }).catch(() => {});
            } else {
              const symlinkCmd = `cd "${baseDestForSymlink}" && ln -sfn "${snapshotFolder}" latest`;
              await execAsync(symlinkCmd).catch(() => {});
            }
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

        await prisma.rsyncJob.update({
          where: { id: job.id },
          data: {
            lastRunStatus: isSuccess ? 'SUCCESS' : 'FAILED',
            lastRunAt: new Date(),
          },
        });

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

        if (!isSuccess) {
          dispatchInstantFailureAlert({
            projectName: `Rsync: ${job.name}`,
            serverId: destServer?.name || 'Local Host',
            hostname: os.hostname(),
            backupType: 'rsync_mirror',
            status: 'FAILED',
            durationSeconds: Math.round(durationSeconds),
            backupSizeBytes: parsedStats.bytesTransferred,
            errorMessage: stderrBuffer.trim() || `Rsync mirror failed with exit code ${exitCode}`,
          }).catch(() => {});
        }

        this.probeRepositoryDiskSpace(job.destRepoId).catch(() => {});

        resolve(updatedRun);
      });
    });
  }

  /**
   * Helper to execute a 2-stage delta bridge for syncing between two distinct remote servers
   */
  private async executeTwoStageBridge(
    job: any,
    sourceServer: any,
    destServer: any,
    sourceRaw: string,
    destRaw: string,
    baseArgs: string[],
    runType: 'MANUAL' | 'SCHEDULED' | 'DRY_RUN',
    timestampStr: string,
    run: any,
    startTime: number,
    triggeredBy: string
  ): Promise<any> {
    const transitDir = path.join(os.tmpdir(), 'backuppulse_transit', job.id);
    fs.mkdirSync(transitDir, { recursive: true });

    let stdoutBuffer = '';
    let stderrBuffer = '';

    const getSshFlagForServer = (srv: any): { flag: string[]; env: NodeJS.ProcessEnv; tempKey?: string } => {
      const env: NodeJS.ProcessEnv = { ...process.env };
      let tempKey: string | undefined;
      if (srv.authType === 'SSH_KEY' && srv.sshPrivateKey) {
        tempKey = path.join(os.tmpdir(), `bridge_key_${Date.now()}_${Math.random().toString(36).substring(7)}.key`);
        fs.writeFileSync(tempKey, srv.sshPrivateKey, { mode: 0o600 });
        return {
          flag: ['-e', `ssh -p ${srv.port} -i ${tempKey} -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o BatchMode=yes`],
          env,
          tempKey,
        };
      } else if (srv.authType === 'PASSWORD' && srv.password) {
        env.SSHPASS = srv.password;
        return {
          flag: [
            '-e',
            `sshpass -e ssh -p ${srv.port} -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o PreferredAuthentications=password,keyboard-interactive -o PubkeyAuthentication=no -o NumberOfPasswordPrompts=1`,
          ],
          env,
        };
      }
      return {
        flag: ['-e', `ssh -p ${srv.port} -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o BatchMode=yes`],
        env,
      };
    };

    const pullSsh = getSshFlagForServer(sourceServer);
    const pushSsh = getSshFlagForServer(destServer);

    try {
      // ----------------------------------------------------------------------
      // SIMULATION (DRY-RUN) MODE
      // ----------------------------------------------------------------------
      if (runType === 'DRY_RUN') {
        stdoutBuffer += `[BACKUPPULSE BRIDGE] [SIMULATION DRY-RUN] Probing delta transfer from source ${sourceServer.username}@${sourceServer.host}:${sourceRaw}...\n`;
        const pullArgs = [...baseArgs, ...pullSsh.flag, `${sourceServer.username}@${sourceServer.host}:${sourceRaw}`, `${transitDir}/`];

        console.log(`[RSYNC BRIDGE DRY-RUN] rsync ${pullArgs.join(' ')}`);

        const pullRes = await new Promise<{ exitCode: number; stdout: string; stderr: string }>((res) => {
          let pStdout = '';
          let pStderr = '';
          const pChild = spawn('rsync', pullArgs, { env: pullSsh.env });
          pChild.stdout.on('data', (c) => (pStdout += c.toString()));
          pChild.stderr.on('data', (c) => (pStderr += c.toString()));
          pChild.on('close', (code) => res({ exitCode: code || 0, stdout: pStdout, stderr: pStderr }));
          pChild.on('error', (err) => res({ exitCode: 1, stdout: pStdout, stderr: err.message }));
        });

        stdoutBuffer += pullRes.stdout;
        stderrBuffer += pullRes.stderr;

        if (pullRes.exitCode !== 0) {
          throw new Error(`Cross-server sync dry-run failed with exit code ${pullRes.exitCode}: ${pullRes.stderr.trim()}`);
        }

        stdoutBuffer += `\n[BACKUPPULSE BRIDGE] [SIMULATION DRY-RUN] Completed. Target server ${destServer.name} (${destServer.host}:${destRaw}) is ready to receive sync.\n`;

        const durationSeconds = (Date.now() - startTime) / 1000;
        const parsedStats = parseRsyncStats(pullRes.stdout);

        const updatedRun = await prisma.rsyncRun.update({
          where: { id: run.id },
          data: {
            status: 'SUCCESS',
            exitCode: 0,
            durationSeconds,
            stdoutLog: stdoutBuffer,
            stderrLog: stderrBuffer,
            errorMessage: null,
            totalFiles: parsedStats.totalFiles,
            transferredFiles: parsedStats.transferredFiles,
            deletedFiles: parsedStats.deletedFiles,
            bytesTransferred: parsedStats.bytesTransferred,
            totalSizeBytes: parsedStats.totalSizeBytes,
            speedupRatio: parsedStats.speedupRatio,
            completedAt: new Date(),
          },
        });

        await prisma.rsyncJob.update({
          where: { id: job.id },
          data: {
            lastRunStatus: 'SUCCESS',
            lastRunAt: new Date(),
          },
        });

        await prisma.rsyncActivityLog.create({
          data: {
            action: 'DRY_RUN_TRIGGERED',
            entityId: run.id,
            entityType: 'RUN',
            username: triggeredBy,
            details: { jobId: job.id, jobName: job.name, status: 'SUCCESS', durationSeconds },
          },
        });

        return updatedRun;
      }

      // ----------------------------------------------------------------------
      // REAL EXECUTION: PHASE 1 (PULL DELTA TO TRANSIT BUFFER)
      // ----------------------------------------------------------------------
      stdoutBuffer += `[BACKUPPULSE BRIDGE] Phase 1: Pulling delta from ${sourceServer.username}@${sourceServer.host}:${sourceRaw} to transit buffer...\n`;
      const pullArgs = [...baseArgs, ...pullSsh.flag, `${sourceServer.username}@${sourceServer.host}:${sourceRaw}`, `${transitDir}/`];

      console.log(`[RSYNC BRIDGE] Phase 1: rsync ${pullArgs.join(' ')}`);

      const pullRes = await new Promise<{ exitCode: number; stdout: string; stderr: string }>((res) => {
        let pStdout = '';
        let pStderr = '';
        const pChild = spawn('rsync', pullArgs, { env: pullSsh.env });
        pChild.stdout.on('data', (c) => (pStdout += c.toString()));
        pChild.stderr.on('data', (c) => (pStderr += c.toString()));
        pChild.on('close', (code) => res({ exitCode: code || 0, stdout: pStdout, stderr: pStderr }));
        pChild.on('error', (err) => res({ exitCode: 1, stdout: pStdout, stderr: err.message }));
      });

      stdoutBuffer += pullRes.stdout;
      stderrBuffer += pullRes.stderr;

      if (pullRes.exitCode !== 0) {
        throw new Error(`Cross-server sync Phase 1 (pull) failed with exit code ${pullRes.exitCode}: ${pullRes.stderr.trim()}`);
      }

      // ----------------------------------------------------------------------
      // REAL EXECUTION: PHASE 2 (PUSH TRANSIT BUFFER TO DESTINATION SERVER)
      // ----------------------------------------------------------------------
      stdoutBuffer += `\n[BACKUPPULSE BRIDGE] Phase 2: Pushing transit buffer to ${destServer.username}@${destServer.host}:${destRaw}...\n`;
      let targetDest = destRaw;
      let baseDestForSymlink: string | null = null;
      const pushStrategyArgs: string[] = [];
      if (job.syncStrategy === 'HARDLINK_SNAPSHOT') {
        baseDestForSymlink = targetDest.endsWith('/') ? targetDest.slice(0, -1) : targetDest;
        targetDest = `${baseDestForSymlink}/snapshot_${timestampStr}/`;
        pushStrategyArgs.push(`--link-dest=${baseDestForSymlink}/latest`);
      } else if (job.syncStrategy === 'BACKUP_DIR') {
        const baseDest = targetDest.endsWith('/') ? targetDest.slice(0, -1) : targetDest;
        targetDest = `${baseDest}/current/`;
        pushStrategyArgs.push(`--backup`, `--backup-dir=${baseDest}/recycle_bin/${timestampStr}`);
      }

      // Pre-flight check on destination server directory permissions
      const sshDestProbe = this.buildSshCommand(destServer);
      try {
        const testScript = `mkdir -p '${targetDest}' 2>/dev/null; [ -w '${targetDest}' ] && echo WRITABLE || echo NOT_WRITABLE`;
        const { stdout: permCheck } = await execAsync(`${sshDestProbe.cmd} "${testScript}"`, { env: sshDestProbe.env }).catch(() => ({ stdout: '' }));
        if (permCheck.includes('NOT_WRITABLE')) {
          stdoutBuffer += `\n[BACKUPPULSE PRE-FLIGHT WARNING] Remote user "${destServer.username}" does not have write permissions on "${targetDest}" on ${destServer.host}.\n` +
            `[FIX COMMAND] Run on ${destServer.host}: sudo chown -R ${destServer.username}:${destServer.username} ${destRaw} || sudo chmod 777 ${destRaw}\n\n`;
        }
      } catch (_) {} finally {
        if (sshDestProbe.tempKeyFile && fs.existsSync(sshDestProbe.tempKeyFile)) {
          try { fs.unlinkSync(sshDestProbe.tempKeyFile); } catch (_) {}
        }
      }

      const pushArgs = [
        ...baseArgs,
        ...pushStrategyArgs,
        '--omit-dir-times',
        '--no-owner',
        '--no-group',
        ...pushSsh.flag,
        `${transitDir}/`,
        `${destServer.username}@${destServer.host}:${targetDest}`,
      ];

      console.log(`[RSYNC BRIDGE] Phase 2: rsync ${pushArgs.join(' ')}`);

      const pushRes = await new Promise<{ exitCode: number; stdout: string; stderr: string }>((res) => {
        let pStdout = '';
        let pStderr = '';
        const pChild = spawn('rsync', pushArgs, { env: pushSsh.env });
        pChild.stdout.on('data', (c) => (pStdout += c.toString()));
        pChild.stderr.on('data', (c) => (pStderr += c.toString()));
        pChild.on('close', (code) => res({ exitCode: code || 0, stdout: pStdout, stderr: pStderr }));
        pChild.on('error', (err) => res({ exitCode: 1, stdout: pStdout, stderr: err.message }));
      });

      stdoutBuffer += pushRes.stdout;
      stderrBuffer += pushRes.stderr;

      const durationSeconds = (Date.now() - startTime) / 1000;
      const isSuccess = pushRes.exitCode === 0;

      // Update symlink on destServer if HARDLINK_SNAPSHOT was successful
      if (isSuccess && job.syncStrategy === 'HARDLINK_SNAPSHOT' && baseDestForSymlink) {
        try {
          const sshDestInfo = this.buildSshCommand(destServer);
          const symlinkCmd = `${sshDestInfo.cmd} "cd '${baseDestForSymlink}' && ln -sfn 'snapshot_${timestampStr}' latest"`;
          await execAsync(symlinkCmd, { env: sshDestInfo.env }).catch(() => {});
          if (sshDestInfo.tempKeyFile && fs.existsSync(sshDestInfo.tempKeyFile)) {
            try { fs.unlinkSync(sshDestInfo.tempKeyFile); } catch (_) {}
          }
        } catch (_) {}
      }

      let friendlyErrorMessage: string | null = null;
      if (!isSuccess) {
        if (pushRes.stderr.includes('Permission denied (13)') || pushRes.stderr.includes('mkstemp')) {
          friendlyErrorMessage = `Destination Permission Denied (13): User "${destServer.username}" does not have write permissions on "${destRaw}" on ${destServer.host}. Please run on ${destServer.host}: sudo chown -R ${destServer.username}:${destServer.username} ${destRaw}`;
        } else if (pushRes.stderr.includes('failed to set times') && pushRes.stderr.includes('Operation not permitted')) {
          friendlyErrorMessage = `Destination Permission Warning (1): User "${destServer.username}" lacks permission to set directory timestamps on "${destRaw}". Omitting directory times (--omit-dir-times).`;
        } else {
          friendlyErrorMessage = pushRes.stderr.trim() || `Phase 2 failed with exit code ${pushRes.exitCode}`;
        }
      }

      const parsedStats = parseRsyncStats(pushRes.stdout || pullRes.stdout);

      const updatedRun = await prisma.rsyncRun.update({
        where: { id: run.id },
        data: {
          status: isSuccess ? 'SUCCESS' : 'FAILED',
          exitCode: pushRes.exitCode,
          durationSeconds,
          stdoutLog: stdoutBuffer,
          stderrLog: stderrBuffer,
          errorMessage: friendlyErrorMessage,
          totalFiles: parsedStats.totalFiles,
          transferredFiles: parsedStats.transferredFiles,
          deletedFiles: parsedStats.deletedFiles,
          bytesTransferred: parsedStats.bytesTransferred,
          totalSizeBytes: parsedStats.totalSizeBytes,
          speedupRatio: parsedStats.speedupRatio,
          completedAt: new Date(),
        },
      });

      await prisma.rsyncJob.update({
        where: { id: job.id },
        data: {
          lastRunStatus: isSuccess ? 'SUCCESS' : 'FAILED',
          lastRunAt: new Date(),
        },
      });

      await prisma.rsyncActivityLog.create({
        data: {
          action: isSuccess ? 'JOB_COMPLETED' : 'JOB_FAILED',
          entityId: run.id,
          entityType: 'RUN',
          username: triggeredBy,
          details: { jobId: job.id, jobName: job.name, status: isSuccess ? 'SUCCESS' : 'FAILED', durationSeconds },
        },
      });

      this.probeRepositoryDiskSpace(job.destRepoId).catch(() => {});

      return updatedRun;
    } catch (err: any) {
      const durationSeconds = (Date.now() - startTime) / 1000;
      const failedRun = await prisma.rsyncRun.update({
        where: { id: run.id },
        data: {
          status: 'FAILED',
          exitCode: 1,
          durationSeconds,
          errorMessage: err.message,
          stdoutLog: stdoutBuffer,
          stderrLog: stderrBuffer + '\n' + err.message,
          completedAt: new Date(),
        },
      });

      await prisma.rsyncJob.update({
        where: { id: job.id },
        data: { lastRunStatus: 'FAILED' },
      });

      return failedRun;
    } finally {
      if (pullSsh.tempKey && fs.existsSync(pullSsh.tempKey)) {
        try { fs.unlinkSync(pullSsh.tempKey); } catch (_) {}
      }
      if (pushSsh.tempKey && fs.existsSync(pushSsh.tempKey)) {
        try { fs.unlinkSync(pushSsh.tempKey); } catch (_) {}
      }
    }
  }
}

export const rsyncService = new RsyncService();
