import React, { useState, useEffect } from 'react';
import {
  X,
  Database,
  Terminal,
  Copy,
  Check,
  Download,
  Key,
  FolderGit2,
  Tag,
  Server,
  Cloud,
  Clock,
  Sparkles,
  ShieldCheck,
  HelpCircle,
  FileCode,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  RefreshCw,
  Layers,
  Archive,
  HardDrive,
  ChevronDown,
  Activity,
  Globe,
} from 'lucide-react';
import { api } from '../services/api';
import { ApiKeyItem } from '../types';
import {
  generatePostgresScript,
  generateMysqlScript,
  generateZipScript,
  generateSftpScript,
  generateMongoScript,
  generateRedisScript,
  generateDockerVolumeScript,
  generateSqliteScript,
  generateCurlSnippet,
  generateCrontabLine,
  generateInstallCommands,
  GeneratorConfig,
  StorageDestination,
} from '../utils/scriptGenerator';
import { CrontabBuilder } from './CrontabBuilder';

interface DeployWizardModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialProjectName?: string;
  initialServerId?: string;
}

export const DeployWizardModal: React.FC<DeployWizardModalProps> = ({
  isOpen,
  onClose,
  initialProjectName,
  initialServerId,
}) => {
  // Application Base URL detection
  const detectedOrigin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
  const defaultApiEndpoint = `${detectedOrigin}/api/v1/backups/report`;

  // Workload selection
  const [backupType, setBackupType] = useState<
    'postgres' | 'mysql' | 'zip' | 'curl' | 'sftp' | 'mongodb' | 'redis' | 'docker' | 'sqlite'
  >('postgres');
  const [customBackupType, setCustomBackupType] = useState<string>('db');

  // MongoDB State
  const [mongoHost, setMongoHost] = useState<string>('127.0.0.1');
  const [mongoPort, setMongoPort] = useState<string>('27017');
  const [mongoUser, setMongoUser] = useState<string>('admin');
  const [mongoPassword, setMongoPassword] = useState<string>('MongoP@ss123');
  const [mongoDbName, setMongoDbName] = useState<string>('ecommerce_mongo');
  const [mongoAuthDb, setMongoAuthDb] = useState<string>('admin');
  const [mongoUri, setMongoUri] = useState<string>('');
  const [mongoMode, setMongoMode] = useState<'standard' | 'uri'>('standard');

  // Redis State
  const [redisHost, setRedisHost] = useState<string>('127.0.0.1');
  const [redisPort, setRedisPort] = useState<string>('6379');
  const [redisPassword, setRedisPassword] = useState<string>('');
  const [redisMethod, setRedisMethod] = useState<'rdb' | 'bgsave'>('rdb');

  // Docker Volume State
  const [dockerVolume, setDockerVolume] = useState<string>('app_data_volume');
  const [dockerContainer, setDockerContainer] = useState<string>('');

  // SQLite State
  const [sqlitePath, setSqlitePath] = useState<string>('/var/www/app/database.sqlite');

  // Storage Destination selection: s3 | gcs | azure | local | shared_drive | sftp
  const [storageDestination, setStorageDestination] = useState<StorageDestination>('s3');

  // SFTP / FTP Remote Server State
  const [sftpProtocol, setSftpProtocol] = useState<'sftp' | 'ftp'>('sftp');
  const [sftpHost, setSftpHost] = useState<string>('sftp.example.com');
  const [sftpPort, setSftpPort] = useState<string>('22');
  const [sftpUser, setSftpUser] = useState<string>('backupuser');
  const [sftpPassword, setSftpPassword] = useState<string>('SftpP@ssw0rd123');
  const [sftpAuthMethod, setSftpAuthMethod] = useState<'password' | 'key'>('password');
  const [sftpKeyPath, setSftpKeyPath] = useState<string>('/root/.ssh/id_rsa');
  const [sftpRemoteDir, setSftpRemoteDir] = useState<string>('/backups');

  // Form Configuration State
  const [apiUrl, setApiUrl] = useState<string>(defaultApiEndpoint);
  const [apiKey, setApiKey] = useState<string>('');
  const [projectName, setProjectName] = useState<string>(initialProjectName || 'ecommerce-prod');
  const [serverId, setServerId] = useState<string>(initialServerId || '');
  const [environment, setEnvironment] = useState<string>('production');

  // AWS S3 Target State
  const [s3Bucket, setS3Bucket] = useState<string>('my-company-backup-vault');
  const [s3Folder, setS3Folder] = useState<string>('ecommerce-prod_db_backup');

  // Google Cloud Storage (GCS) State
  const [gcsBucket, setGcsBucket] = useState<string>('my-gcp-backup-vault');
  const [gcsFolder, setGcsFolder] = useState<string>('ecommerce-prod_db_backup');

  // Azure Blob Storage State
  const [azureStorageAccount, setAzureStorageAccount] = useState<string>('mybackupstorage');
  const [azureContainer, setAzureContainer] = useState<string>('backups');
  const [azureFolder, setAzureFolder] = useState<string>('ecommerce-prod_db_backup');
  const [azureSasToken, setAzureSasToken] = useState<string>('');
  const [azureConnectionString, setAzureConnectionString] = useState<string>('');

  // Local / Shared Drive / Staging State
  const [localBackupDir, setLocalBackupDir] = useState<string>('/var/backups/postgres');
  const [sharedDrivePath, setSharedDrivePath] = useState<string>('/mnt/backup_share');
  const [backupPath, setBackupPath] = useState<string>('/var/backups/postgres');
  const [retentionDays, setRetentionDays] = useState<number>(30);
  const [maxFiles, setMaxFiles] = useState<number>(30);
  const [minSizeKb, setMinSizeKb] = useState<number>(35);

  // Database specific
  const [dbUser, setDbUser] = useState<string>('postgres');
  const [dbPassword, setDbPassword] = useState<string>('P@ssword123');
  const [dbHost, setDbHost] = useState<string>('127.0.0.1');
  const [dbPort, setDbPort] = useState<string>('5432');
  const [dbName, setDbName] = useState<string>('ecommerce_prod');

  // Zip specific
  const [sourcePath, setSourcePath] = useState<string>('/var/www/html');
  const [excludePatterns, setExcludePatterns] = useState<string>('node_modules/* .git/* *.log cache/* tmp/*');

  // Crontab schedule
  const [cronSchedule, setCronSchedule] = useState<string>('59 23 * * *');

  // Token management inside wizard
  const [existingKeys, setExistingKeys] = useState<ApiKeyItem[]>([]);
  const [generatingToken, setGeneratingToken] = useState<boolean>(false);
  const [tokenGeneratedBanner, setTokenGeneratedBanner] = useState<string | null>(null);

  // Disaster Recovery / Restore Drill
  const [enableRestoreDrill, setEnableRestoreDrill] = useState<boolean>(false);

  // Active Output Tab
  const [outputTab, setOutputTab] = useState<'script' | 'command' | 'preflight' | 'crontab' | 'prereq'>('script');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Auto-sync folder name with project name if user hasn't explicitly changed it
  useEffect(() => {
    if (projectName) {
      const folder =
        backupType === 'postgres'
          ? `${projectName}_postgres_backup`
          : backupType === 'mysql'
          ? `${projectName}_mysql_backup`
          : backupType === 'mongodb'
          ? `${projectName}_mongo_backup`
          : backupType === 'redis'
          ? `${projectName}_redis_backup`
          : backupType === 'docker'
          ? `${projectName}_docker_backup`
          : backupType === 'sqlite'
          ? `${projectName}_sqlite_backup`
          : backupType === 'sftp'
          ? `${projectName}_sftp_backup`
          : `${projectName}_zip_backup`;
      setS3Folder(folder);
      setGcsFolder(folder);
      setAzureFolder(folder);
    }
  }, [projectName, backupType]);

  // Adjust defaults when backupType changes
  useEffect(() => {
    if (backupType === 'postgres') {
      setDbUser('postgres');
      setDbPort('5432');
      setBackupPath('/var/backups/postgres');
      setLocalBackupDir('/var/backups/postgres');
      setCustomBackupType('db');
    } else if (backupType === 'mysql') {
      setDbUser('root');
      setDbPort('3306');
      setBackupPath('/var/backups/mysql');
      setLocalBackupDir('/var/backups/mysql');
      setCustomBackupType('db');
    } else if (backupType === 'mongodb') {
      setBackupPath('/var/backups/mongodb');
      setLocalBackupDir('/var/backups/mongodb');
      setCustomBackupType('db');
    } else if (backupType === 'redis') {
      setBackupPath('/var/backups/redis');
      setLocalBackupDir('/var/backups/redis');
      setCustomBackupType('db');
    } else if (backupType === 'docker') {
      setBackupPath('/var/backups/docker');
      setLocalBackupDir('/var/backups/docker');
      setCustomBackupType('zip');
    } else if (backupType === 'sqlite') {
      setBackupPath('/var/backups/sqlite');
      setLocalBackupDir('/var/backups/sqlite');
      setCustomBackupType('db');
    } else if (backupType === 'zip') {
      setBackupPath('/var/backups/zip');
      setLocalBackupDir('/var/backups/zip');
      setCustomBackupType('zip');
    } else if (backupType === 'sftp') {
      setBackupPath('/tmp/backup_staging');
      setStorageDestination('sftp');
      setCustomBackupType('sftp');
    } else if (backupType === 'curl') {
      setCustomBackupType('custom');
    }
  }, [backupType]);

  // Load existing API tokens if available
  useEffect(() => {
    if (isOpen) {
      api
        .getApiKeys()
        .then((res) => {
          setExistingKeys(res.data.filter((k) => k.isActive));
        })
        .catch(() => {});
    }
  }, [isOpen]);

  // 1-Click Generate Fresh API Key directly from within wizard
  const handleGenerateFreshToken = async () => {
    setGeneratingToken(true);
    setTokenGeneratedBanner(null);
    try {
      const tokenName = `${projectName || 'Server'} Ingestion Key`;
      const res = await api.createApiKey({
        name: tokenName,
        projectName: projectName.trim() || undefined,
        serverId: serverId.trim() || undefined,
        expiresInDays: 365,
      });

      setApiKey(res.key);
      setTokenGeneratedBanner(`Generated new scoped token: "${res.apiKey.name}" (Expires in 365 days)`);
    } catch (err: any) {
      alert(`Could not generate token: ${err.message}`);
    } finally {
      setGeneratingToken(false);
    }
  };

  const copyText = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(id);
    setTimeout(() => setCopiedCode(null), 2500);
  };

  const currentConfig: GeneratorConfig = {
    backupType,
    customBackupType:
      customBackupType.trim() ||
      (backupType === 'zip' || backupType === 'docker'
        ? 'zip'
        : backupType === 'sftp'
        ? 'sftp'
        : backupType === 'curl'
        ? 'custom'
        : 'db'),
    storageDestination,
    apiUrl: apiUrl.trim() || defaultApiEndpoint,
    apiKey: apiKey.trim() || 'bkp_live_secret_key_12345',
    projectName: projectName.trim() || 'demo_project',
    serverId: serverId.trim() || undefined,
    environment,
    retentionDays: Number(retentionDays) || 30,
    maxFiles: Number(maxFiles) || 30,
    minSizeKb: Number(minSizeKb) || 35,
    s3Bucket: s3Bucket.trim() || 'my-backup-vault',
    s3Folder: s3Folder.trim() || 'backups',
    gcsBucket: gcsBucket.trim() || 'my-gcp-backup-vault',
    gcsFolder: gcsFolder.trim() || 'backups',
    azureStorageAccount: azureStorageAccount.trim() || 'mybackupstorage',
    azureContainer: azureContainer.trim() || 'backups',
    azureFolder: azureFolder.trim() || 'backups',
    azureSasToken: azureSasToken.trim() || undefined,
    azureConnectionString: azureConnectionString.trim() || undefined,
    sftpProtocol,
    sftpHost: sftpHost.trim() || 'sftp.example.com',
    sftpPort: sftpPort.trim() || (sftpProtocol === 'ftp' ? '21' : '22'),
    sftpUser: sftpUser.trim() || 'backupuser',
    sftpPassword,
    sftpAuthMethod,
    sftpKeyPath: sftpKeyPath.trim() || '/root/.ssh/id_rsa',
    sftpRemoteDir: sftpRemoteDir.trim() || '/backups',
    backupPath: backupPath.trim() || '/var/backups',
    localBackupDir: localBackupDir.trim() || '/var/backups',
    sharedDrivePath: sharedDrivePath.trim() || '/mnt/backup_share',
    dbUser,
    dbPassword,
    dbHost,
    dbPort,
    dbName,
    sourcePath,
    excludePatterns,
    cronSchedule,
    enableRestoreDrill,
    mongoUri,
    mongoHost,
    mongoPort,
    mongoUser,
    mongoPassword,
    mongoDbName,
    mongoAuthDb,
    redisHost,
    redisPort,
    redisPassword,
    redisMethod,
    dockerVolume,
    dockerContainer,
    sqlitePath,
  };

  const preflightCmd = `curl -fsSL "${detectedOrigin}/api/v1/scripts/preflight?type=${backupType === 'zip' ? 'directory' : backupType}&dest=${storageDestination === 'shared_drive' ? 'mapped' : storageDestination}&drill=${enableRestoreDrill}" | bash`;

  // Generate code outputs based on backupType and storageDestination
  let generatedScript = '';
  let defaultScriptName = 'backup.sh';
  const destTag =
    storageDestination === 's3'
      ? 's3'
      : storageDestination === 'gcs'
      ? 'gcs'
      : storageDestination === 'azure'
      ? 'azure'
      : storageDestination === 'sftp'
      ? 'sftp'
      : storageDestination === 'local'
      ? 'local'
      : 'shared';

  if (backupType === 'postgres') {
    generatedScript = generatePostgresScript(currentConfig);
    defaultScriptName = `postgres_${destTag}_backup_${projectName || 'db'}.sh`;
  } else if (backupType === 'mysql') {
    generatedScript = generateMysqlScript(currentConfig);
    defaultScriptName = `mysql_${destTag}_backup_${projectName || 'db'}.sh`;
  } else if (backupType === 'mongodb') {
    generatedScript = generateMongoScript(currentConfig);
    defaultScriptName = `mongo_${destTag}_backup_${projectName || 'db'}.sh`;
  } else if (backupType === 'redis') {
    generatedScript = generateRedisScript(currentConfig);
    defaultScriptName = `redis_${destTag}_backup_${projectName || 'db'}.sh`;
  } else if (backupType === 'docker') {
    generatedScript = generateDockerVolumeScript(currentConfig);
    defaultScriptName = `docker_volume_${destTag}_backup_${projectName || 'volume'}.sh`;
  } else if (backupType === 'sqlite') {
    generatedScript = generateSqliteScript(currentConfig);
    defaultScriptName = `sqlite_${destTag}_backup_${projectName || 'db'}.sh`;
  } else if (backupType === 'zip') {
    generatedScript = generateZipScript(currentConfig);
    defaultScriptName = `zip_${destTag}_backup_${projectName || 'files'}.sh`;
  } else if (backupType === 'sftp') {
    generatedScript = generateSftpScript(currentConfig);
    defaultScriptName = `${sftpProtocol}_backup_${projectName || 'files'}.sh`;
  } else {
    generatedScript = generateCurlSnippet(currentConfig);
    defaultScriptName = 'send_backup_telemetry.sh';
  }

  // 1-Liner CLI Execution Command with storage-aware flags
  const targetScriptPath = `/opt/scripts/${defaultScriptName}`;
  const destArg =
    storageDestination === 's3'
      ? `--destination "s3" --s3-bucket "${s3Bucket}"`
      : storageDestination === 'gcs'
      ? `--destination "gcs" --gcs-bucket "${gcsBucket}"`
      : storageDestination === 'azure'
      ? `--destination "azure" --azure-account "${azureStorageAccount}" --azure-container "${azureContainer}"`
      : storageDestination === 'sftp'
      ? `--destination "sftp" --sftp-host "${sftpHost}" --sftp-user "${sftpUser}"`
      : storageDestination === 'local'
      ? `--destination "local" --local-dir "${localBackupDir}"`
      : `--destination "shared_drive" --shared-dir "${sharedDrivePath}"`;

  const generatedCliCommand =
    backupType === 'postgres'
      ? `bash ${targetScriptPath} --project "${projectName}" --db-name "${dbName}" ${destArg} --retention-days ${retentionDays}`
      : backupType === 'mysql'
      ? `bash ${targetScriptPath} --project "${projectName}" --db-name "${dbName}" ${destArg} --retention-days ${retentionDays}`
      : backupType === 'mongodb'
      ? `bash ${targetScriptPath} --project "${projectName}" --db-name "${mongoDbName}" ${destArg} --retention-days ${retentionDays}`
      : backupType === 'redis'
      ? `bash ${targetScriptPath} --project "${projectName}" --redis-host "${redisHost}" --redis-port "${redisPort}" ${destArg} --retention-days ${retentionDays}`
      : backupType === 'docker'
      ? `bash ${targetScriptPath} --project "${projectName}" --volume "${dockerVolume}" ${destArg} --retention-days ${retentionDays}`
      : backupType === 'sqlite'
      ? `bash ${targetScriptPath} --project "${projectName}" --sqlite-path "${sqlitePath}" ${destArg} --retention-days ${retentionDays}`
      : backupType === 'zip'
      ? `bash ${targetScriptPath} --project "${projectName}" --source-path "${sourcePath}" ${destArg} --retention-days ${retentionDays}`
      : backupType === 'sftp'
      ? `bash ${targetScriptPath} --project "${projectName}" --source-path "${sourcePath}" --sftp-host "${sftpHost}" --sftp-user "${sftpUser}" --retention-days ${retentionDays}`
      : `bash ${targetScriptPath}`;

  const generatedCrontab = generateCrontabLine(targetScriptPath, cronSchedule);
  const effectiveTargetDir =
    storageDestination === 'local'
      ? localBackupDir
      : storageDestination === 'shared_drive'
      ? sharedDrivePath
      : backupPath;
  const installCommands = generateInstallCommands(backupType, backupPath, storageDestination, effectiveTargetDir, currentConfig);

  // Trigger browser file download of .sh script
  const handleDownloadScript = () => {
    const blob = new Blob([generatedScript], { type: 'text/x-sh;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = defaultScriptName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-200">
      <div
        className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-6xl shadow-2xl flex flex-col max-h-[94vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/70">
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 rounded-2xl bg-gradient-to-tr from-emerald-600 via-teal-500 to-cyan-400 flex items-center justify-center shadow-lg shadow-emerald-500/20">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-lg font-bold text-white tracking-tight">Deploy New Server Wizard</h2>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-medium">
                  1-Click Multi-Cloud Generator
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Pre-configured backup agents for AWS S3, Google Cloud Storage, Azure Blob, Local Disk, and Shared Network Drives.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title="Close Deployment Wizard"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body: Two Column Responsive Layout */}
        <div className="flex-1 overflow-y-auto grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-slate-800">
          {/* ================= LEFT COLUMN: CONFIGURATION INPUTS (5 cols) ================= */}
          <div className="lg:col-span-5 p-6 space-y-5 bg-slate-900/60 overflow-y-auto text-xs">
            {/* Step 1: Workload Type Selector */}
            <div>
              <label className="block text-slate-300 font-semibold mb-2">1. Select Workload / Backup Type</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setBackupType('postgres')}
                  className={`p-3 rounded-2xl border flex flex-col items-start transition-all text-left ${
                    backupType === 'postgres'
                      ? 'bg-emerald-950/60 border-emerald-500 text-white shadow-md shadow-emerald-950/40'
                      : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center space-x-2 mb-1">
                    <span className="text-base">🐘</span>
                    <span className="font-bold text-xs text-white">PostgreSQL</span>
                  </div>
                  <span className="text-[10px] text-slate-400 leading-tight">
                    pg_dump + .zip compression + Telemetry
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setBackupType('mysql')}
                  className={`p-3 rounded-2xl border flex flex-col items-start transition-all text-left ${
                    backupType === 'mysql'
                      ? 'bg-emerald-950/60 border-emerald-500 text-white shadow-md shadow-emerald-950/40'
                      : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center space-x-2 mb-1">
                    <span className="text-base">🐬</span>
                    <span className="font-bold text-xs text-white">MySQL / MariaDB</span>
                  </div>
                  <span className="text-[10px] text-slate-400 leading-tight">
                    mysqldump online snapshot + Telemetry
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setBackupType('mongodb')}
                  className={`p-3 rounded-2xl border flex flex-col items-start transition-all text-left ${
                    backupType === 'mongodb'
                      ? 'bg-emerald-950/60 border-emerald-500 text-white shadow-md shadow-emerald-950/40'
                      : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center space-x-2 mb-1">
                    <span className="text-base">🍃</span>
                    <span className="font-bold text-xs text-white">MongoDB</span>
                  </div>
                  <span className="text-[10px] text-slate-400 leading-tight">
                    mongodump --archive --gzip + Telemetry
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setBackupType('redis')}
                  className={`p-3 rounded-2xl border flex flex-col items-start transition-all text-left ${
                    backupType === 'redis'
                      ? 'bg-emerald-950/60 border-emerald-500 text-white shadow-md shadow-emerald-950/40'
                      : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center space-x-2 mb-1">
                    <span className="text-base">🔴</span>
                    <span className="font-bold text-xs text-white">Redis</span>
                  </div>
                  <span className="text-[10px] text-slate-400 leading-tight">
                    redis-cli --rdb snapshot + Telemetry
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setBackupType('docker')}
                  className={`p-3 rounded-2xl border flex flex-col items-start transition-all text-left ${
                    backupType === 'docker'
                      ? 'bg-emerald-950/60 border-emerald-500 text-white shadow-md shadow-emerald-950/40'
                      : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center space-x-2 mb-1">
                    <span className="text-base">🐳</span>
                    <span className="font-bold text-xs text-white">Docker Volumes</span>
                  </div>
                  <span className="text-[10px] text-slate-400 leading-tight">
                    Volume export tar -czf + Telemetry
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setBackupType('sqlite')}
                  className={`p-3 rounded-2xl border flex flex-col items-start transition-all text-left ${
                    backupType === 'sqlite'
                      ? 'bg-emerald-950/60 border-emerald-500 text-white shadow-md shadow-emerald-950/40'
                      : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center space-x-2 mb-1">
                    <span className="text-base">🪶</span>
                    <span className="font-bold text-xs text-white">SQLite</span>
                  </div>
                  <span className="text-[10px] text-slate-400 leading-tight">
                    sqlite3 online .backup + Telemetry
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setBackupType('zip')}
                  className={`p-3 rounded-2xl border flex flex-col items-start transition-all text-left ${
                    backupType === 'zip'
                      ? 'bg-emerald-950/60 border-emerald-500 text-white shadow-md shadow-emerald-950/40'
                      : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center space-x-2 mb-1">
                    <Archive className="h-4 w-4 text-cyan-400" />
                    <span className="font-bold text-xs text-white">Directory Zip</span>
                  </div>
                  <span className="text-[10px] text-slate-400 leading-tight">
                    Code / Assets directory + Telemetry
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setBackupType('sftp')}
                  className={`p-3 rounded-2xl border flex flex-col items-start transition-all text-left ${
                    backupType === 'sftp'
                      ? 'bg-emerald-950/60 border-emerald-500 text-white shadow-md shadow-emerald-950/40'
                      : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center space-x-2 mb-1">
                    <Globe className="h-4 w-4 text-teal-400" />
                    <span className="font-bold text-xs text-white">SFTP / FTP</span>
                  </div>
                  <span className="text-[10px] text-slate-400 leading-tight">
                    Direct upload to remote SFTP / FTP server
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setBackupType('curl')}
                  className={`p-3 rounded-2xl border flex flex-col items-start transition-all text-left ${
                    backupType === 'curl'
                      ? 'bg-emerald-950/60 border-emerald-500 text-white shadow-md shadow-emerald-950/40'
                      : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center space-x-2 mb-1">
                    <Terminal className="h-4 w-4 text-amber-400" />
                    <span className="font-bold text-xs text-white">Single curl Call</span>
                  </div>
                  <span className="text-[10px] text-slate-400 leading-tight">
                    Embed directly into existing bash scripts
                  </span>
                </button>
              </div>
            </div>

            {/* Step 2: Project & Ingestion Hub Settings */}
            <div className="space-y-3 pt-2 border-t border-slate-800/80">
              <label className="block text-slate-300 font-semibold">2. Target Project & Ingestion Security</label>

              <div>
                <label className="block text-slate-400 mb-1">Project Name *</label>
                <div className="relative">
                  <FolderGit2 className="h-3.5 w-3.5 text-slate-500 absolute left-3 top-3" />
                  <input
                    type="text"
                    required
                    value={projectName}
                    onChange={(e) => setProjectName(e.target.value)}
                    placeholder="e.g. LJS_ERP_RANNUTSAV or ecommerce-prod"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-white focus:outline-none focus:border-emerald-500 font-mono text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1 flex items-center justify-between">
                  <span>Backup Type Identifier *</span>
                  <span className="text-[10px] text-slate-500 font-mono">
                    Default: {backupType === 'postgres' || backupType === 'mysql' || backupType === 'mongodb' || backupType === 'redis' || backupType === 'sqlite' ? 'db' : backupType === 'zip' || backupType === 'docker' ? 'zip' : backupType === 'sftp' ? 'sftp' : 'custom'}
                  </span>
                </label>
                <div className="relative">
                  <Tag className="h-3.5 w-3.5 text-slate-500 absolute left-3 top-3" />
                  <input
                    type="text"
                    required
                    value={customBackupType}
                    onChange={(e) => setCustomBackupType(e.target.value)}
                    placeholder={backupType === 'zip' || backupType === 'docker' ? 'zip' : backupType === 'sftp' ? 'sftp' : backupType === 'curl' ? 'custom' : 'db'}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-white focus:outline-none focus:border-emerald-500 font-mono text-xs"
                  />
                </div>
                <span className="text-[10px] text-slate-500 mt-1 block">
                  Identifier recorded in telemetry reports (e.g. <code>db</code>, <code>zip</code>, <code>custom</code>, or any custom name).
                </span>
              </div>

              {/* API Token Input with 1-Click Generate Button */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-slate-400 font-medium">Ingestion API Token *</label>
                  <button
                    type="button"
                    onClick={handleGenerateFreshToken}
                    disabled={generatingToken}
                    className="text-[11px] font-semibold text-amber-400 hover:text-amber-300 flex items-center space-x-1 transition-colors disabled:opacity-50"
                    title="Generate a new scoped token in 1 click"
                  >
                    {generatingToken ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Sparkles className="h-3 w-3" />
                    )}
                    <span>⚡ Generate New Token</span>
                  </button>
                </div>
                <div className="relative">
                  <Key className="h-3.5 w-3.5 text-amber-400 absolute left-3 top-3" />
                  <input
                    type="text"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="bkp_live_secret_key_... or click Generate"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-white focus:outline-none focus:border-amber-500 font-mono text-xs"
                  />
                </div>

                {tokenGeneratedBanner && (
                  <div className="mt-1.5 p-2 rounded-lg bg-emerald-950/70 border border-emerald-600/40 text-emerald-300 text-[11px] flex items-center space-x-1.5 animate-in fade-in">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                    <span className="truncate">{tokenGeneratedBanner}</span>
                  </div>
                )}
              </div>

              {/* Server ID (Optional) */}
              <div>
                <label className="block text-slate-400 mb-1">
                  Server ID Scope (Optional)
                  <span className="text-slate-500 font-normal ml-1">
                    (Leave empty to allow any server)
                  </span>
                </label>
                <div className="relative">
                  <Server className="h-3.5 w-3.5 text-slate-500 absolute left-3 top-3" />
                  <input
                    type="text"
                    value={serverId}
                    onChange={(e) => setServerId(e.target.value)}
                    placeholder="e.g. 15.206.222.190 or hostname (or blank)"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-white focus:outline-none focus:border-emerald-500 font-mono text-xs"
                  />
                </div>
              </div>

              {/* Hub Endpoint URL */}
              <div>
                <label className="block text-slate-400 mb-1">Central BackupPulse Hub API URL</label>
                <input
                  type="text"
                  value={apiUrl}
                  onChange={(e) => setApiUrl(e.target.value)}
                  placeholder={defaultApiEndpoint}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-300 focus:outline-none focus:border-emerald-500 font-mono text-[11px]"
                />
              </div>
            </div>

            {/* Step 3: Workload Specific Connection Details (Configurable for all workload types) */}
            <div className="space-y-3 pt-2 border-t border-slate-800/80">
              <label className="block text-slate-300 font-semibold">
                3. {backupType === 'zip'
                  ? 'Directory Settings & Security'
                  : backupType === 'sftp'
                  ? 'Remote SFTP / FTP Server & Source'
                  : backupType === 'mongodb'
                  ? 'MongoDB Connection & Authentication'
                  : backupType === 'redis'
                  ? 'Redis Server & Snapshot Settings'
                  : backupType === 'docker'
                  ? 'Docker Volume Target & Staging'
                  : backupType === 'sqlite'
                  ? 'SQLite Database File Path'
                  : backupType === 'curl'
                  ? 'Database Credentials & Connection (Optional)'
                  : 'Database Connection'}
              </label>

              {backupType === 'sftp' ? (
                <>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-slate-400 mb-1">Protocol *</label>
                      <select
                        value={sftpProtocol}
                        onChange={(e) => {
                          const proto = e.target.value as 'sftp' | 'ftp';
                          setSftpProtocol(proto);
                          if (proto === 'ftp' && sftpPort === '22') setSftpPort('21');
                          if (proto === 'sftp' && sftpPort === '21') setSftpPort('22');
                        }}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500 font-mono text-xs"
                      >
                        <option value="sftp">SFTP (SSH)</option>
                        <option value="ftp">FTP</option>
                      </select>
                    </div>
                    <div className="col-span-2">
                      <label className="block text-slate-400 mb-1">Remote Server Host / IP *</label>
                      <input
                        type="text"
                        value={sftpHost}
                        onChange={(e) => setSftpHost(e.target.value)}
                        placeholder="sftp.example.com or 192.168.1.100"
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500 font-mono text-xs"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="block text-slate-400 mb-1">Port *</label>
                      <input
                        type="text"
                        value={sftpPort}
                        onChange={(e) => setSftpPort(e.target.value)}
                        placeholder={sftpProtocol === 'ftp' ? '21' : '22'}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500 font-mono text-xs"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-slate-400 mb-1">Username *</label>
                      <input
                        type="text"
                        value={sftpUser}
                        onChange={(e) => setSftpUser(e.target.value)}
                        placeholder="backupuser"
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500 font-mono text-xs"
                      />
                    </div>
                  </div>

                  {sftpProtocol === 'sftp' && (
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setSftpAuthMethod('password')}
                        className={`py-1.5 px-3 rounded-xl border text-xs font-semibold transition-all ${
                          sftpAuthMethod === 'password'
                            ? 'bg-emerald-950/60 border-emerald-500 text-white'
                            : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        🔑 Password Auth
                      </button>
                      <button
                        type="button"
                        onClick={() => setSftpAuthMethod('key')}
                        className={`py-1.5 px-3 rounded-xl border text-xs font-semibold transition-all ${
                          sftpAuthMethod === 'key'
                            ? 'bg-emerald-950/60 border-emerald-500 text-white'
                            : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        🛡️ SSH Private Key
                      </button>
                    </div>
                  )}

                  {sftpProtocol === 'ftp' || sftpAuthMethod === 'password' ? (
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-slate-400">Password</label>
                        <span className="text-[10px] text-emerald-400 font-mono">Single-quote safe ('...')</span>
                      </div>
                      <input
                        type="text"
                        value={sftpPassword}
                        onChange={(e) => setSftpPassword(e.target.value)}
                        placeholder="Remote server password"
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500 font-mono text-xs"
                      />
                      <p className="text-[10px] text-slate-500 mt-1">
                        Special characters ($, !, #, &, @, etc.) are safely preserved in single quotes.
                      </p>
                    </div>
                  ) : (
                    <div>
                      <label className="block text-slate-400 mb-1">SSH Private Key Path *</label>
                      <input
                        type="text"
                        value={sftpKeyPath}
                        onChange={(e) => setSftpKeyPath(e.target.value)}
                        placeholder="/root/.ssh/id_rsa or /home/deploy/.ssh/id_ed25519"
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500 font-mono text-xs"
                      />
                    </div>
                  )}

                  <div>
                    <label className="block text-slate-400 mb-1">Remote Target Directory *</label>
                    <input
                      type="text"
                      value={sftpRemoteDir}
                      onChange={(e) => setSftpRemoteDir(e.target.value)}
                      placeholder="/backups or /home/backupuser/backups"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500 font-mono text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1">Source Directory Path to Backup *</label>
                    <input
                      type="text"
                      value={sourcePath}
                      onChange={(e) => setSourcePath(e.target.value)}
                      placeholder="/var/www/html or /opt/app"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500 font-mono text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1">Exclude Patterns</label>
                    <input
                      type="text"
                      value={excludePatterns}
                      onChange={(e) => setExcludePatterns(e.target.value)}
                      placeholder="node_modules/* .git/* *.log"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500 font-mono text-xs"
                    />
                  </div>
                </>
              ) : backupType === 'mongodb' ? (
                <>
                  <div className="flex items-center space-x-2 mb-2">
                    <button
                      type="button"
                      onClick={() => setMongoMode('standard')}
                      className={`px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all ${
                        mongoMode === 'standard'
                          ? 'bg-emerald-950/60 border-emerald-500 text-white'
                          : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      Standard (Host/Port)
                    </button>
                    <button
                      type="button"
                      onClick={() => setMongoMode('uri')}
                      className={`px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all ${
                        mongoMode === 'uri'
                          ? 'bg-emerald-950/60 border-emerald-500 text-white'
                          : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      Connection URI
                    </button>
                  </div>

                  {mongoMode === 'standard' ? (
                    <>
                      <div className="grid grid-cols-3 gap-2">
                        <div className="col-span-2">
                          <label className="block text-slate-400 mb-1">Host *</label>
                          <input
                            type="text"
                            value={mongoHost}
                            onChange={(e) => setMongoHost(e.target.value)}
                            placeholder="127.0.0.1"
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500 font-mono text-xs"
                          />
                        </div>
                        <div>
                          <label className="block text-slate-400 mb-1">Port *</label>
                          <input
                            type="text"
                            value={mongoPort}
                            onChange={(e) => setMongoPort(e.target.value)}
                            placeholder="27017"
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500 font-mono text-xs"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-slate-400 mb-1">Database Name</label>
                          <input
                            type="text"
                            value={mongoDbName}
                            onChange={(e) => setMongoDbName(e.target.value)}
                            placeholder="Leave empty for all DBs"
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500 font-mono text-xs"
                          />
                        </div>
                        <div>
                          <label className="block text-slate-400 mb-1">Auth Database</label>
                          <input
                            type="text"
                            value={mongoAuthDb}
                            onChange={(e) => setMongoAuthDb(e.target.value)}
                            placeholder="admin"
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500 font-mono text-xs"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-slate-400 mb-1">Username (Optional)</label>
                        <input
                          type="text"
                          value={mongoUser}
                          onChange={(e) => setMongoUser(e.target.value)}
                          placeholder="admin"
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500 font-mono text-xs"
                        />
                      </div>

                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="text-slate-400">Password (Optional)</label>
                          <span className="text-[10px] text-emerald-400 font-mono">Single-quote safe ('...')</span>
                        </div>
                        <input
                          type="text"
                          value={mongoPassword}
                          onChange={(e) => setMongoPassword(e.target.value)}
                          placeholder="Secret password (special characters $, !, #, &, @ preserved)"
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500 font-mono text-xs"
                        />
                        <p className="text-[10px] text-slate-500 mt-1">
                          Special characters ($, !, #, &, @, etc.) are safely preserved in single quotes to prevent bash expansion.
                        </p>
                      </div>
                    </>
                  ) : (
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-slate-400">MongoDB Connection URI *</label>
                        <span className="text-[10px] text-emerald-400 font-mono">Single-quote safe ('...')</span>
                      </div>
                      <input
                        type="text"
                        value={mongoUri}
                        onChange={(e) => setMongoUri(e.target.value)}
                        placeholder="mongodb://username:password@127.0.0.1:27017/dbname?authSource=admin"
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500 font-mono text-xs"
                      />
                      <p className="text-[10px] text-slate-500 mt-1">
                        Full connection string URI or MongoDB Atlas SRV URI (<code className="text-slate-400">mongodb+srv://...</code>).
                      </p>
                    </div>
                  )}
                </>
              ) : backupType === 'redis' ? (
                <>
                  <div>
                    <label className="block text-slate-400 mb-1.5 font-medium">Snapshot Method *</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setRedisMethod('rdb')}
                        className={`p-2.5 rounded-xl border text-left transition-all ${
                          redisMethod === 'rdb'
                            ? 'bg-emerald-950/60 border-emerald-500 text-white'
                            : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        <div className="font-semibold text-xs text-white">⚡ Direct RDB Stream</div>
                        <div className="text-[10px] text-slate-400 mt-0.5"><code>redis-cli --rdb</code> (Non-blocking direct network stream)</div>
                      </button>
                      <button
                        type="button"
                        onClick={() => setRedisMethod('bgsave')}
                        className={`p-2.5 rounded-xl border text-left transition-all ${
                          redisMethod === 'bgsave'
                            ? 'bg-emerald-950/60 border-emerald-500 text-white'
                            : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-white'
                        }`}
                      >
                        <div className="font-semibold text-xs text-white">💾 Background Save</div>
                        <div className="text-[10px] text-slate-400 mt-0.5"><code>BGSAVE</code> (Triggers save & copies dump.rdb)</div>
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div className="col-span-2">
                      <label className="block text-slate-400 mb-1">Redis Host *</label>
                      <input
                        type="text"
                        value={redisHost}
                        onChange={(e) => setRedisHost(e.target.value)}
                        placeholder="127.0.0.1"
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500 font-mono text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-1">Port *</label>
                      <input
                        type="text"
                        value={redisPort}
                        onChange={(e) => setRedisPort(e.target.value)}
                        placeholder="6379"
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500 font-mono text-xs"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-slate-400">Redis Password / AUTH (Optional)</label>
                      <span className="text-[10px] text-emerald-400 font-mono">Single-quote safe ('...')</span>
                    </div>
                    <input
                      type="text"
                      value={redisPassword}
                      onChange={(e) => setRedisPassword(e.target.value)}
                      placeholder="AUTH password if enabled"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500 font-mono text-xs"
                    />
                    <p className="text-[10px] text-slate-500 mt-1">
                      Passwords with special characters are safely enclosed in single quotes.
                    </p>
                  </div>
                </>
              ) : backupType === 'docker' ? (
                <>
                  <div>
                    <label className="block text-slate-400 mb-1">Docker Volume Name *</label>
                    <input
                      type="text"
                      value={dockerVolume}
                      onChange={(e) => setDockerVolume(e.target.value)}
                      placeholder="app_data_volume or production_db_data"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500 font-mono text-xs"
                    />
                    <p className="text-[10px] text-slate-500 mt-1">
                      Exported using an ephemeral read-only <code>alpine</code> container to avoid interrupting running services.
                    </p>
                  </div>

                  <div>
                    <label className="block text-slate-400 mb-1">Associated Container Name (Optional)</label>
                    <input
                      type="text"
                      value={dockerContainer}
                      onChange={(e) => setDockerContainer(e.target.value)}
                      placeholder="e.g. web_app_1 or postgres_db"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500 font-mono text-xs"
                    />
                    <p className="text-[10px] text-slate-500 mt-1">
                      Optional container reference recorded in backup telemetry metadata.
                    </p>
                  </div>
                </>
              ) : backupType === 'sqlite' ? (
                <>
                  <div>
                    <label className="block text-slate-400 mb-1">SQLite Database File Path *</label>
                    <input
                      type="text"
                      value={sqlitePath}
                      onChange={(e) => setSqlitePath(e.target.value)}
                      placeholder="/var/www/app/database.sqlite or /data/production.db"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500 font-mono text-xs"
                    />
                    <p className="text-[10px] text-slate-500 mt-1">
                      Uses SQLite's online non-blocking <code>.backup</code> command to snapshot without locking active read/write operations.
                    </p>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-slate-400">Archive / Encryption Password (Optional)</label>
                      <span className="text-[10px] text-emerald-400 font-mono">Single-quote safe ('...')</span>
                    </div>
                    <input
                      type="text"
                      value={dbPassword}
                      onChange={(e) => setDbPassword(e.target.value)}
                      placeholder="Optional encryption password"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500 font-mono text-xs"
                    />
                    <p className="text-[10px] text-slate-500 mt-1">
                      Special characters ($, !, #, &, @, etc.) are safely preserved in single quotes.
                    </p>
                  </div>
                </>
              ) : backupType === 'postgres' || backupType === 'mysql' || backupType === 'curl' ? (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-slate-400 mb-1">DB Name {backupType !== 'curl' && '*'}</label>
                      <input
                        type="text"
                        value={dbName}
                        onChange={(e) => setDbName(e.target.value)}
                        placeholder="ecommerce_prod"
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500 font-mono text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-1">DB User {backupType !== 'curl' && '*'}</label>
                      <input
                        type="text"
                        value={dbUser}
                        onChange={(e) => setDbUser(e.target.value)}
                        placeholder="postgres"
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500 font-mono text-xs"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div className="col-span-2">
                      <label className="block text-slate-400 mb-1">DB Host {backupType !== 'curl' && '*'}</label>
                      <input
                        type="text"
                        value={dbHost}
                        onChange={(e) => setDbHost(e.target.value)}
                        placeholder="127.0.0.1"
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500 font-mono text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-400 mb-1">Port</label>
                      <input
                        type="text"
                        value={dbPort}
                        onChange={(e) => setDbPort(e.target.value)}
                        placeholder={backupType === 'postgres' ? '5432' : '3306'}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500 font-mono text-xs"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-slate-400">DB Password (Stored locally in script)</label>
                      <span className="text-[10px] text-emerald-400 font-mono">Single-quote safe ('...')</span>
                    </div>
                    <input
                      type="text"
                      value={dbPassword}
                      onChange={(e) => setDbPassword(e.target.value)}
                      placeholder="Secret password (special characters $, !, #, &, @ preserved)"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500 font-mono text-xs"
                    />
                    <p className="text-[10px] text-slate-500 mt-1">
                      Passwords with special characters ($, !, #, &, @, etc.) are safely enclosed in single quotes in the generated code to prevent bash variable expansion.
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="block text-slate-400 mb-1">Source Directory Path *</label>
                    <input
                      type="text"
                      value={sourcePath}
                      onChange={(e) => setSourcePath(e.target.value)}
                      placeholder="/var/www/html or /opt/app"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500 font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">Exclude Patterns</label>
                    <input
                      type="text"
                      value={excludePatterns}
                      onChange={(e) => setExcludePatterns(e.target.value)}
                      placeholder="node_modules/* .git/* *.log"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500 font-mono text-xs"
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-slate-400">Archive / Encryption Password (Optional)</label>
                      <span className="text-[10px] text-emerald-400 font-mono">Single-quote safe ('...')</span>
                    </div>
                    <input
                      type="text"
                      value={dbPassword}
                      onChange={(e) => setDbPassword(e.target.value)}
                      placeholder="Optional encryption password"
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500 font-mono text-xs"
                    />
                    <p className="text-[10px] text-slate-500 mt-1">
                      Special characters ($, !, #, &, @, etc.) are safely preserved in single quotes.
                    </p>
                  </div>
                </>
              )}
            </div>

            {/* Step 4: Storage Destination & Retention Policy (Available for all backup types) */}
            <div className="space-y-3 pt-2 border-t border-slate-800/80">
              <label className="block text-slate-300 font-semibold">
                4. Backup Destination & Storage Target *
              </label>

                {/* Destination Dropdown */}
                <div className="relative">
                  <select
                    value={storageDestination}
                    onChange={(e) => setStorageDestination(e.target.value as StorageDestination)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-white font-semibold focus:outline-none focus:border-emerald-500 text-xs cursor-pointer appearance-none"
                  >
                    <option value="s3">☁️ AWS S3 Bucket (Amazon Web Services)</option>
                    <option value="gcs">🌐 Google Cloud Storage (GCP Bucket)</option>
                    <option value="azure">🔷 Azure Blob Storage (Microsoft Azure)</option>
                    <option value="sftp">🌐 Remote SFTP / FTP Server (SSH File Transfer)</option>
                    <option value="local">💻 Local Server Path (Store on Same Server)</option>
                    <option value="shared_drive">📁 Mapped Shared Drive / NFS / CIFS Mount</option>
                  </select>
                  <ChevronDown className="h-4 w-4 text-slate-400 absolute right-3 top-3 pointer-events-none" />
                </div>

                {/* AWS S3 Inputs */}
                {storageDestination === 's3' && (
                  <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800/80 space-y-3 animate-in fade-in">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-slate-400 mb-1">AWS S3 Bucket *</label>
                        <input
                          type="text"
                          value={s3Bucket}
                          onChange={(e) => setS3Bucket(e.target.value)}
                          placeholder="my-company-backup-vault"
                          className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500 font-mono text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-400 mb-1">S3 Folder Prefix</label>
                        <input
                          type="text"
                          value={s3Folder}
                          onChange={(e) => setS3Folder(e.target.value)}
                          placeholder={`${projectName}_backup`}
                          className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500 font-mono text-xs"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-slate-400 mb-1">Local Staging Directory (Temporary)</label>
                      <input
                        type="text"
                        value={backupPath}
                        onChange={(e) => setBackupPath(e.target.value)}
                        placeholder="/var/backups"
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500 font-mono text-xs"
                      />
                    </div>
                  </div>
                )}

                {/* Google Cloud Storage (GCS) Inputs */}
                {storageDestination === 'gcs' && (
                  <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800/80 space-y-3 animate-in fade-in">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-slate-400 mb-1">GCS Bucket Name *</label>
                        <input
                          type="text"
                          value={gcsBucket}
                          onChange={(e) => setGcsBucket(e.target.value)}
                          placeholder="my-gcp-backup-vault"
                          className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500 font-mono text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-400 mb-1">GCS Folder Prefix</label>
                        <input
                          type="text"
                          value={gcsFolder}
                          onChange={(e) => setGcsFolder(e.target.value)}
                          placeholder={`${projectName}_backup`}
                          className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500 font-mono text-xs"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-slate-400 mb-1">Local Staging Directory (Temporary)</label>
                      <input
                        type="text"
                        value={backupPath}
                        onChange={(e) => setBackupPath(e.target.value)}
                        placeholder="/var/backups"
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500 font-mono text-xs"
                      />
                    </div>

                    <div className="p-2.5 rounded-xl bg-blue-950/40 border border-blue-800/30 text-blue-300 text-[11px] flex items-center space-x-2">
                      <Cloud className="h-4 w-4 text-blue-400 shrink-0" />
                      <span>
                        Backups stream directly to Google Cloud Storage (<code>gs://{gcsBucket}/{gcsFolder}</code>) via <code>gcloud storage</code> or <code>gsutil</code> with automated retention pruning.
                      </span>
                    </div>
                  </div>
                )}

                {/* Azure Blob Storage Inputs */}
                {storageDestination === 'azure' && (
                  <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800/80 space-y-3 animate-in fade-in">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-slate-400 mb-1">Storage Account Name *</label>
                        <input
                          type="text"
                          value={azureStorageAccount}
                          onChange={(e) => setAzureStorageAccount(e.target.value)}
                          placeholder="mybackupstorage"
                          className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500 font-mono text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-400 mb-1">Container Name *</label>
                        <input
                          type="text"
                          value={azureContainer}
                          onChange={(e) => setAzureContainer(e.target.value)}
                          placeholder="backups"
                          className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500 font-mono text-xs"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-slate-400 mb-1">Blob Folder Prefix</label>
                        <input
                          type="text"
                          value={azureFolder}
                          onChange={(e) => setAzureFolder(e.target.value)}
                          placeholder={`${projectName}_backup`}
                          className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500 font-mono text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-400 mb-1">SAS Token (Optional)</label>
                        <input
                          type="text"
                          value={azureSasToken}
                          onChange={(e) => setAzureSasToken(e.target.value)}
                          placeholder="sp=racwd&st=..."
                          className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500 font-mono text-xs"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-slate-400 mb-1">Local Staging Directory (Temporary)</label>
                      <input
                        type="text"
                        value={backupPath}
                        onChange={(e) => setBackupPath(e.target.value)}
                        placeholder="/var/backups"
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500 font-mono text-xs"
                      />
                    </div>

                    <div className="p-2.5 rounded-xl bg-cyan-950/40 border border-cyan-800/30 text-cyan-300 text-[11px] flex items-center space-x-2">
                      <Cloud className="h-4 w-4 text-cyan-400 shrink-0" />
                      <span>
                        Backups upload to Azure Blob Container (<code>{azureContainer}</code>) via <code>az</code> CLI or <code>azcopy</code> (supports SAS Token, Connection String, or Managed Identity).
                      </span>
                    </div>
                  </div>
                )}

                {/* Local Server Storage Inputs */}
                {storageDestination === 'local' && (
                  <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800/80 space-y-3 animate-in fade-in">
                    <div>
                      <label className="block text-slate-400 mb-1">Target Local Storage Directory *</label>
                      <input
                        type="text"
                        value={localBackupDir}
                        onChange={(e) => setLocalBackupDir(e.target.value)}
                        placeholder={
                          backupType === 'postgres'
                            ? '/var/backups/postgres'
                            : backupType === 'mysql'
                            ? '/var/backups/mysql'
                            : backupType === 'mongodb'
                            ? '/var/backups/mongodb'
                            : backupType === 'redis'
                            ? '/var/backups/redis'
                            : backupType === 'docker'
                            ? '/var/backups/docker'
                            : backupType === 'sqlite'
                            ? '/var/backups/sqlite'
                            : '/var/backups/zip'
                        }
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500 font-mono text-xs"
                      />
                    </div>

                    <div className="p-2.5 rounded-xl bg-emerald-950/40 border border-emerald-800/30 text-emerald-300 text-[11px] flex items-center space-x-2">
                      <HardDrive className="h-4 w-4 text-emerald-400 shrink-0" />
                      <span>
                        No cloud account required! Backups are compressed and stored permanently in this directory on the same server, with automatic local retention pruning.
                      </span>
                    </div>
                  </div>
                )}

                {/* Shared Drive Inputs */}
                {storageDestination === 'shared_drive' && (
                  <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800/80 space-y-3 animate-in fade-in">
                    <div>
                      <label className="block text-slate-400 mb-1">Target Mapped Shared Drive Path *</label>
                      <input
                        type="text"
                        value={sharedDrivePath}
                        onChange={(e) => setSharedDrivePath(e.target.value)}
                        placeholder="/mnt/backup_share or /mnt/nfs_backups"
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500 font-mono text-xs"
                      />
                    </div>

                    <div>
                      <label className="block text-slate-400 mb-1">Local Staging Temp Directory</label>
                      <input
                        type="text"
                        value={backupPath}
                        onChange={(e) => setBackupPath(e.target.value)}
                        placeholder="/tmp/backup_staging"
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500 font-mono text-xs"
                      />
                    </div>

                    <div className="p-2.5 rounded-xl bg-cyan-950/40 border border-cyan-800/30 text-cyan-300 text-[11px] flex items-center space-x-2">
                      <FolderGit2 className="h-4 w-4 text-cyan-400 shrink-0" />
                      <span>
                        Archives are compressed locally and copied directly to your mounted NFS, SMB, or CIFS network storage drive.
                      </span>
                    </div>
                  </div>
                )}

                {/* Remote SFTP / FTP Destination Inputs */}
                {storageDestination === 'sftp' && (
                  <div className="p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800/80 space-y-3 animate-in fade-in">
                    {backupType === 'sftp' ? (
                      <div className="p-2.5 rounded-xl bg-teal-950/40 border border-teal-800/30 text-teal-300 text-[11px] flex items-center space-x-2">
                        <Globe className="h-4 w-4 text-teal-400 shrink-0" />
                        <span>
                          Remote server target is configured in Step 3 (<code>{sftpProtocol}://{sftpUser}@{sftpHost}:{sftpPort}{sftpRemoteDir}</code>).
                        </span>
                      </div>
                    ) : (
                      <>
                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <label className="block text-slate-400 mb-1">Protocol *</label>
                            <select
                              value={sftpProtocol}
                              onChange={(e) => {
                                const proto = e.target.value as 'sftp' | 'ftp';
                                setSftpProtocol(proto);
                                if (proto === 'ftp' && sftpPort === '22') setSftpPort('21');
                                if (proto === 'sftp' && sftpPort === '21') setSftpPort('22');
                              }}
                              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500 font-mono text-xs"
                            >
                              <option value="sftp">SFTP (SSH)</option>
                              <option value="ftp">FTP</option>
                            </select>
                          </div>
                          <div className="col-span-2">
                            <label className="block text-slate-400 mb-1">Remote Server Host / IP *</label>
                            <input
                              type="text"
                              value={sftpHost}
                              onChange={(e) => setSftpHost(e.target.value)}
                              placeholder="sftp.example.com or 192.168.1.100"
                              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500 font-mono text-xs"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <label className="block text-slate-400 mb-1">Port *</label>
                            <input
                              type="text"
                              value={sftpPort}
                              onChange={(e) => setSftpPort(e.target.value)}
                              placeholder={sftpProtocol === 'ftp' ? '21' : '22'}
                              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500 font-mono text-xs"
                            />
                          </div>
                          <div className="col-span-2">
                            <label className="block text-slate-400 mb-1">Username *</label>
                            <input
                              type="text"
                              value={sftpUser}
                              onChange={(e) => setSftpUser(e.target.value)}
                              placeholder="backupuser"
                              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500 font-mono text-xs"
                            />
                          </div>
                        </div>

                        {sftpProtocol === 'sftp' && (
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              onClick={() => setSftpAuthMethod('password')}
                              className={`py-1.5 px-3 rounded-xl border text-xs font-semibold transition-all ${
                                sftpAuthMethod === 'password'
                                  ? 'bg-emerald-950/60 border-emerald-500 text-white'
                                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                              }`}
                            >
                              🔑 Password
                            </button>
                            <button
                              type="button"
                              onClick={() => setSftpAuthMethod('key')}
                              className={`py-1.5 px-3 rounded-xl border text-xs font-semibold transition-all ${
                                sftpAuthMethod === 'key'
                                  ? 'bg-emerald-950/60 border-emerald-500 text-white'
                                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                              }`}
                            >
                              🛡️ SSH Key
                            </button>
                          </div>
                        )}

                        {sftpProtocol === 'ftp' || sftpAuthMethod === 'password' ? (
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <label className="text-slate-400">Password</label>
                              <span className="text-[10px] text-emerald-400 font-mono">Single-quote safe ('...')</span>
                            </div>
                            <input
                              type="text"
                              value={sftpPassword}
                              onChange={(e) => setSftpPassword(e.target.value)}
                              placeholder="Remote server password"
                              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500 font-mono text-xs"
                            />
                          </div>
                        ) : (
                          <div>
                            <label className="block text-slate-400 mb-1">SSH Private Key Path *</label>
                            <input
                              type="text"
                              value={sftpKeyPath}
                              onChange={(e) => setSftpKeyPath(e.target.value)}
                              placeholder="/root/.ssh/id_rsa"
                              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500 font-mono text-xs"
                            />
                          </div>
                        )}

                        <div>
                          <label className="block text-slate-400 mb-1">Remote Target Directory *</label>
                          <input
                            type="text"
                            value={sftpRemoteDir}
                            onChange={(e) => setSftpRemoteDir(e.target.value)}
                            placeholder="/backups"
                            className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500 font-mono text-xs"
                          />
                        </div>
                      </>
                    )}

                    <div>
                      <label className="block text-slate-400 mb-1">Local Staging Temp Directory</label>
                      <input
                        type="text"
                        value={backupPath}
                        onChange={(e) => setBackupPath(e.target.value)}
                        placeholder="/tmp/backup_staging"
                        className="w-full bg-slate-900 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500 font-mono text-xs"
                      />
                    </div>

                    <div className="p-2.5 rounded-xl bg-teal-950/40 border border-teal-800/30 text-teal-300 text-[11px] flex items-center space-x-2">
                      <Globe className="h-4 w-4 text-teal-400 shrink-0" />
                      <span>
                        Archives are packaged locally, then transferred to <code>{sftpProtocol}://{sftpHost}:{sftpPort}{sftpRemoteDir}</code> with automatic remote retention pruning.
                      </span>
                    </div>
                  </div>
                )}

                {/* Common Retention & Anomaly Controls */}
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-slate-400 mb-1">Retention (Days)</label>
                    <input
                      type="number"
                      min={1}
                      value={retentionDays}
                      onChange={(e) => setRetentionDays(Number(e.target.value))}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500 font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">
                      {storageDestination === 's3'
                        ? 'Max Files in S3'
                        : storageDestination === 'gcs'
                        ? 'Max Files in GCS'
                        : storageDestination === 'azure'
                        ? 'Max Blobs'
                        : storageDestination === 'sftp'
                        ? 'Max Remote Files'
                        : storageDestination === 'local'
                        ? 'Max Local Files'
                        : 'Max Shared Files'}
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={maxFiles}
                      onChange={(e) => setMaxFiles(Number(e.target.value))}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500 font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">Min Size (KB)</label>
                    <input
                      type="number"
                      min={1}
                      value={minSizeKb}
                      onChange={(e) => setMinSizeKb(Number(e.target.value))}
                      className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500 font-mono text-xs"
                    />
                  </div>
                </div>

                {/* Step 4.1: Optional Automated Restoration Drill (DrillPulse) */}
                <div className="pt-2 border-t border-slate-800/80">
                  <div className="p-3 rounded-2xl bg-slate-950/80 border border-slate-800 hover:border-slate-700 transition-colors">
                    <label className="flex items-start space-x-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={enableRestoreDrill}
                        onChange={(e) => setEnableRestoreDrill(e.target.checked)}
                        className="mt-0.5 h-4 w-4 rounded text-emerald-500 bg-slate-900 border-slate-700 focus:ring-emerald-500/30 cursor-pointer"
                      />
                      <div className="space-y-1">
                        <div className="flex items-center space-x-1.5">
                          <span className="text-xs font-semibold text-white">
                            🧪 Automated Restoration Drill (DrillPulse)
                          </span>
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            DR Verified
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 leading-relaxed">
                          Spawns an ephemeral sandbox container to restore dump and verify table counts before certification.
                        </p>
                      </div>
                    </label>
                  </div>
                </div>
              </div>
          </div>

          {/* ================= RIGHT COLUMN: GENERATED OUTPUTS & INSTRUCTIONS (7 cols) ================= */}
          <div className="lg:col-span-7 flex flex-col h-full bg-slate-950/80">
            {/* Output Sub-Tabs (Two-Line Layout with Two-Line Cards) */}
            <div className="p-4 border-b border-slate-800 bg-slate-900/60 space-y-3">
              {/* Line 1: The 5 Deployment Mode Cards (Two-Line Card Design) */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
                {/* 1. Full Script */}
                <button
                  type="button"
                  onClick={() => setOutputTab('script')}
                  className={`p-2.5 rounded-xl border text-left transition-all flex flex-col justify-between ${
                    outputTab === 'script'
                      ? 'bg-emerald-600/20 border-emerald-500 text-white shadow-md shadow-emerald-950/40 ring-1 ring-emerald-500/50'
                      : 'bg-slate-950/70 border-slate-800/90 text-slate-400 hover:text-white hover:bg-slate-900/90'
                  }`}
                >
                  <div className="flex items-center space-x-1.5 font-bold text-xs">
                    <FileCode className={`h-3.5 w-3.5 shrink-0 ${outputTab === 'script' ? 'text-emerald-400' : 'text-slate-400'}`} />
                    <span className="truncate">Full Script (.sh)</span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono mt-1 block truncate">Ready-to-deploy</span>
                </button>

                {/* 2. 1-Liner Run */}
                <button
                  type="button"
                  onClick={() => setOutputTab('command')}
                  className={`p-2.5 rounded-xl border text-left transition-all flex flex-col justify-between ${
                    outputTab === 'command'
                      ? 'bg-indigo-600/20 border-indigo-500 text-white shadow-md shadow-indigo-950/40 ring-1 ring-indigo-500/50'
                      : 'bg-slate-950/70 border-slate-800/90 text-slate-400 hover:text-white hover:bg-slate-900/90'
                  }`}
                >
                  <div className="flex items-center space-x-1.5 font-bold text-xs">
                    <Terminal className={`h-3.5 w-3.5 shrink-0 ${outputTab === 'command' ? 'text-indigo-400' : 'text-slate-400'}`} />
                    <span className="truncate">1-Liner Run</span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono mt-1 block truncate">curl | bash command</span>
                </button>

                {/* 3. Pre-Flight Check */}
                <button
                  type="button"
                  onClick={() => setOutputTab('preflight')}
                  className={`p-2.5 rounded-xl border text-left transition-all flex flex-col justify-between ${
                    outputTab === 'preflight'
                      ? 'bg-cyan-600/20 border-cyan-500 text-white shadow-md shadow-cyan-950/40 ring-1 ring-cyan-500/50'
                      : 'bg-slate-950/70 border-slate-800/90 text-slate-400 hover:text-white hover:bg-slate-900/90'
                  }`}
                >
                  <div className="flex items-center space-x-1.5 font-bold text-xs">
                    <Activity className={`h-3.5 w-3.5 shrink-0 ${outputTab === 'preflight' ? 'text-cyan-400' : 'text-slate-400'}`} />
                    <span className="truncate">Pre-Flight Check</span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono mt-1 block truncate">🩺 agent-check.sh</span>
                </button>

                {/* 4. Crontab */}
                <button
                  type="button"
                  onClick={() => setOutputTab('crontab')}
                  className={`p-2.5 rounded-xl border text-left transition-all flex flex-col justify-between ${
                    outputTab === 'crontab'
                      ? 'bg-purple-600/20 border-purple-500 text-white shadow-md shadow-purple-950/40 ring-1 ring-purple-500/50'
                      : 'bg-slate-950/70 border-slate-800/90 text-slate-400 hover:text-white hover:bg-slate-900/90'
                  }`}
                >
                  <div className="flex items-center space-x-1.5 font-bold text-xs">
                    <Clock className={`h-3.5 w-3.5 shrink-0 ${outputTab === 'crontab' ? 'text-purple-400' : 'text-slate-400'}`} />
                    <span className="truncate">Crontab Entry</span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono mt-1 block truncate">Auto schedule</span>
                </button>

                {/* 5. Pre-requisites */}
                <button
                  type="button"
                  onClick={() => setOutputTab('prereq')}
                  className={`p-2.5 rounded-xl border text-left transition-all flex flex-col justify-between ${
                    outputTab === 'prereq'
                      ? 'bg-amber-600/20 border-amber-500 text-white shadow-md shadow-amber-950/40 ring-1 ring-amber-500/50'
                      : 'bg-slate-950/70 border-slate-800/90 text-slate-400 hover:text-white hover:bg-slate-900/90'
                  }`}
                >
                  <div className="flex items-center space-x-1.5 font-bold text-xs">
                    <ShieldCheck className={`h-3.5 w-3.5 shrink-0 ${outputTab === 'prereq' ? 'text-amber-400' : 'text-slate-400'}`} />
                    <span className="truncate">Pre-requisites</span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-mono mt-1 block truncate">CLI packages</span>
                </button>
              </div>

              {/* Line 2: Actions Bar & File Info */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-2 border-t border-slate-800/80">
                <div className="flex items-center space-x-2 text-xs overflow-hidden">
                  <span className="flex items-center space-x-1.5 text-white font-mono text-[11px] bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800 truncate">
                    <FileCode className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                    <span className="truncate font-semibold">
                      {outputTab === 'script'
                        ? defaultScriptName
                        : outputTab === 'command'
                        ? '1-liner.sh'
                        : outputTab === 'preflight'
                        ? 'agent-check.sh'
                        : outputTab === 'crontab'
                        ? 'crontab -e'
                        : 'dependencies.sh'}
                    </span>
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-slate-800 text-[10px] text-slate-300 font-mono border border-slate-700 shrink-0">
                    Target:{' '}
                    <strong className="text-emerald-400">
                      {storageDestination === 's3'
                        ? 'AWS S3'
                        : storageDestination === 'gcs'
                        ? 'Google Cloud Storage'
                        : storageDestination === 'azure'
                        ? 'Azure Blob Storage'
                        : storageDestination === 'sftp'
                        ? 'Remote SFTP / FTP'
                        : storageDestination === 'local'
                        ? 'Local Storage'
                        : 'Shared Drive / NFS'}
                    </strong>
                  </span>
                </div>

                {/* Actions: Download .sh & Copy Snippet */}
                <div className="flex items-center space-x-2 shrink-0">
                  {outputTab === 'script' && (
                    <button
                      type="button"
                      onClick={handleDownloadScript}
                      className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 transition-colors shadow-sm"
                      title={`Download ${defaultScriptName}`}
                    >
                      <Download className="h-3.5 w-3.5 text-cyan-400" />
                      <span>Download .sh</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => {
                      const toCopy =
                        outputTab === 'script'
                          ? generatedScript
                          : outputTab === 'command'
                          ? generatedCliCommand
                          : outputTab === 'preflight'
                          ? preflightCmd
                          : outputTab === 'crontab'
                          ? generateCrontabLine(targetScriptPath, cronSchedule)
                          : `${installCommands.debian}\n\n${installCommands.prep}\n\n# ${installCommands.storageTitle}\n${installCommands.storageCommand}`;
                      copyText(toCopy, outputTab);
                    }}
                    className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition-all shadow-md shadow-emerald-950/40"
                  >
                    {copiedCode === outputTab ? (
                      <>
                        <Check className="h-3.5 w-3.5 text-white" />
                        <span>Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5 text-white" />
                        <span>Copy Code</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Output Display Area */}
            <div className="flex-1 p-6 overflow-y-auto font-mono text-xs">
              {outputTab === 'script' && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-slate-400 text-[11px] pb-2 border-b border-slate-800">
                    <span className="flex items-center space-x-1.5">
                      <FileCode className="h-4 w-4 text-emerald-400" />
                      <span className="text-white font-semibold">{defaultScriptName}</span>
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-slate-800 text-[10px] text-slate-300">
                      Destination:{' '}
                      <strong className="text-emerald-400">
                        {storageDestination === 's3'
                          ? 'AWS S3'
                          : storageDestination === 'gcs'
                          ? 'Google Cloud Storage'
                          : storageDestination === 'azure'
                          ? 'Azure Blob Storage'
                          : storageDestination === 'local'
                          ? 'Local Storage'
                          : 'Shared Drive'}
                      </strong>
                    </span>
                  </div>
                  <pre className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-slate-300 overflow-x-auto text-[11px] leading-relaxed select-all">
                    {generatedScript}
                  </pre>
                </div>
              )}

              {outputTab === 'command' && (
                <div className="space-y-4">
                  <div className="text-slate-400 text-xs leading-relaxed">
                    Execute this command on your server to run an instant backup and test telemetry dispatch:
                  </div>
                  <div className="relative group">
                    <pre className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-emerald-400 overflow-x-auto text-xs leading-relaxed select-all">
                      {generatedCliCommand}
                    </pre>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-2 text-xs text-slate-300">
                    <div className="font-semibold text-white flex items-center space-x-1.5">
                      <Sparkles className="h-4 w-4 text-emerald-400" />
                      <span>Simulate with Dry-Run Mode</span>
                    </div>
                    <p className="text-[11px] text-slate-400">
                      Add <code className="text-emerald-400">--dry-run</code> to the command above to test arguments and connectivity without executing real dumps or copying files.
                    </p>
                  </div>
                </div>
              )}

              {outputTab === 'preflight' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between text-slate-400 text-xs leading-relaxed">
                    <span>Execute this 1-line pre-flight checker on your server to verify environment prerequisites:</span>
                    <span className="px-2 py-0.5 rounded-md bg-cyan-950/60 border border-cyan-800/40 text-[10px] text-cyan-300 font-mono">
                      agent-check.sh
                    </span>
                  </div>

                  <div className="relative group">
                    <pre className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-cyan-300 overflow-x-auto text-xs leading-relaxed select-all">
                      {preflightCmd}
                    </pre>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3 text-xs text-slate-300">
                    <div className="font-semibold text-white flex items-center space-x-1.5">
                      <ShieldCheck className="h-4 w-4 text-cyan-400" />
                      <span>Diagnostics verified in ~10 seconds:</span>
                    </div>
                    <ul className="space-y-2 text-[11px] text-slate-400">
                      <li className="flex items-center space-x-2">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                        <span>Core POSIX utilities: <code className="text-slate-200">curl</code>, <code className="text-slate-200">gzip</code>, <code className="text-slate-200">awk</code>, <code className="text-slate-200">sha256sum</code>, <code className="text-slate-200">zip</code></span>
                      </li>
                      <li className="flex items-center space-x-2">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                        <span>Target engine client: <code className="text-slate-200">{backupType === 'postgres' ? 'pg_dump & psql' : backupType === 'mysql' ? 'mysqldump & mysqladmin' : backupType === 'mongodb' ? 'mongodump & mongosh' : backupType === 'redis' ? 'redis-cli' : backupType === 'docker' ? 'docker CLI & daemon' : backupType === 'sqlite' ? 'sqlite3' : backupType === 'sftp' ? 'lftp / scp / sftp' : 'zip'}</code></span>
                      </li>
                      <li className="flex items-center space-x-2">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                        <span>Storage target CLI & authentication: <strong className="text-slate-200">{storageDestination === 's3' ? 'AWS CLI credentials' : storageDestination === 'gcs' ? 'Google Cloud SDK / gsutil' : storageDestination === 'azure' ? 'Azure CLI / AzCopy' : 'Local filesystem permissions'}</strong></span>
                      </li>
                      <li className="flex items-center space-x-2">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                        <span>BackupPulse Hub egress network connectivity (<code className="text-slate-200">{apiUrl}</code>)</span>
                      </li>
                      <li className="flex items-center space-x-2">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                        <span>Local staging directory free capacity (<code className="text-slate-200">df -h</code>)</span>
                      </li>
                      {enableRestoreDrill && (
                        <li className="flex items-center space-x-2 text-cyan-300">
                          <CheckCircle2 className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
                          <span>Docker engine active (for ephemeral DrillPulse container restoration)</span>
                        </li>
                      )}
                    </ul>
                  </div>
                </div>
              )}

              {outputTab === 'crontab' && (
                <CrontabBuilder
                  value={cronSchedule}
                  onChange={setCronSchedule}
                  scriptPath={targetScriptPath}
                />
              )}

              {outputTab === 'prereq' && (
                <div className="space-y-4">
                  <div>
                    <h4 className="text-white font-semibold text-xs mb-1.5 flex items-center space-x-1.5">
                      <span>📦 1. Install System Dependencies (Ubuntu / Debian)</span>
                    </h4>
                    <pre className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-cyan-300 overflow-x-auto text-xs select-all">
                      {installCommands.debian}
                    </pre>
                  </div>

                  <div>
                    <h4 className="text-white font-semibold text-xs mb-1.5 flex items-center space-x-1.5">
                      <span>📦 2. Install System Dependencies (RHEL / CentOS / Rocky)</span>
                    </h4>
                    <pre className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-cyan-300 overflow-x-auto text-xs select-all">
                      {installCommands.rhel}
                    </pre>
                  </div>

                  <div>
                    <h4 className="text-white font-semibold text-xs mb-1.5 flex items-center space-x-1.5">
                      <span>📁 3. Storage Directory Setup & Permissions</span>
                    </h4>
                    <pre className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-emerald-400 overflow-x-auto text-xs select-all">
                      {installCommands.prep}
                    </pre>
                  </div>

                  <div>
                    <h4 className="text-white font-semibold text-xs mb-1.5 flex items-center space-x-1.5">
                      <span>{installCommands.storageTitle}</span>
                    </h4>
                    <p className="text-[11px] text-slate-400 mb-2 leading-relaxed">
                      {installCommands.storageHelp}
                    </p>
                    <pre className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-amber-300 overflow-x-auto text-xs select-all">
                      {installCommands.storageCommand}
                    </pre>
                  </div>
                </div>
              )}
            </div>

            {/* Footer Summary / Quick Action */}
            <div className="p-4 border-t border-slate-800 bg-slate-950 flex items-center justify-between text-xs">
              <div className="flex items-center space-x-2 text-slate-400">
                <ShieldCheck className="h-4 w-4 text-emerald-400" />
                <span>
                  Project <strong className="text-white font-mono">{projectName}</strong> • Target:{' '}
                  <strong className="text-emerald-400 font-mono">
                    {storageDestination === 's3'
                      ? `s3://${s3Bucket}`
                      : storageDestination === 'gcs'
                      ? `gs://${gcsBucket}`
                      : storageDestination === 'azure'
                      ? `Azure: ${azureContainer}`
                      : storageDestination === 'sftp'
                      ? `${sftpProtocol}://${sftpHost}:${sftpPort}${sftpRemoteDir}`
                      : storageDestination === 'local'
                      ? localBackupDir
                      : sharedDrivePath}
                  </strong>
                </span>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 font-semibold transition-colors"
              >
                Done / Close
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
