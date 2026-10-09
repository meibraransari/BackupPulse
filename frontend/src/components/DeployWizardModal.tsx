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
} from 'lucide-react';
import { api } from '../services/api';
import { ApiKeyItem } from '../types';
import {
  generatePostgresScript,
  generateMysqlScript,
  generateZipScript,
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
  const [backupType, setBackupType] = useState<'postgres' | 'mysql' | 'zip' | 'curl'>('postgres');

  // Storage Destination selection: s3 | gcs | azure | local | shared_drive
  const [storageDestination, setStorageDestination] = useState<StorageDestination>('s3');

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
    } else if (backupType === 'mysql') {
      setDbUser('root');
      setDbPort('3306');
      setBackupPath('/var/backups/mysql');
      setLocalBackupDir('/var/backups/mysql');
    } else if (backupType === 'zip') {
      setBackupPath('/var/backups/zip');
      setLocalBackupDir('/var/backups/zip');
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
      : storageDestination === 'local'
      ? 'local'
      : 'shared';

  if (backupType === 'postgres') {
    generatedScript = generatePostgresScript(currentConfig);
    defaultScriptName = `postgres_${destTag}_backup_${projectName || 'db'}.sh`;
  } else if (backupType === 'mysql') {
    generatedScript = generateMysqlScript(currentConfig);
    defaultScriptName = `mysql_${destTag}_backup_${projectName || 'db'}.sh`;
  } else if (backupType === 'zip') {
    generatedScript = generateZipScript(currentConfig);
    defaultScriptName = `zip_${destTag}_backup_${projectName || 'files'}.sh`;
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
      : storageDestination === 'local'
      ? `--destination "local" --local-dir "${localBackupDir}"`
      : `--destination "shared_drive" --shared-dir "${sharedDrivePath}"`;

  const generatedCliCommand =
    backupType === 'postgres'
      ? `bash ${targetScriptPath} --project "${projectName}" --db-name "${dbName}" ${destArg} --retention-days ${retentionDays}`
      : backupType === 'mysql'
      ? `bash ${targetScriptPath} --project "${projectName}" --db-name "${dbName}" ${destArg} --retention-days ${retentionDays}`
      : backupType === 'zip'
      ? `bash ${targetScriptPath} --project "${projectName}" --source-path "${sourcePath}" ${destArg} --retention-days ${retentionDays}`
      : `bash ${targetScriptPath}`;

  const generatedCrontab = generateCrontabLine(targetScriptPath, cronSchedule);
  const effectiveTargetDir =
    storageDestination === 'local'
      ? localBackupDir
      : storageDestination === 'shared_drive'
      ? sharedDrivePath
      : backupPath;
  const installCommands = generateInstallCommands(backupType, backupPath, storageDestination, effectiveTargetDir);

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
              <div className="grid grid-cols-2 gap-2">
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

            {/* Step 3: Workload Specific Connection Details */}
            {backupType !== 'curl' && (
              <div className="space-y-3 pt-2 border-t border-slate-800/80">
                <label className="block text-slate-300 font-semibold">
                  3. {backupType === 'zip' ? 'Directory Settings' : 'Database Connection'}
                </label>

                {backupType === 'postgres' || backupType === 'mysql' ? (
                  <>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-slate-400 mb-1">DB Name *</label>
                        <input
                          type="text"
                          value={dbName}
                          onChange={(e) => setDbName(e.target.value)}
                          placeholder="ljscrm"
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500 font-mono text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-400 mb-1">DB User *</label>
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
                        <label className="block text-slate-400 mb-1">DB Host *</label>
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
                      <label className="block text-slate-400 mb-1">DB Password (Optional / Stored locally)</label>
                      <input
                        type="text"
                        value={dbPassword}
                        onChange={(e) => setDbPassword(e.target.value)}
                        placeholder="Secret password"
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-emerald-500 font-mono text-xs"
                      />
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
                  </>
                )}
              </div>
            )}

            {/* Step 4: Storage Destination & Retention Policy */}
            {backupType !== 'curl' && (
              <div className="space-y-3 pt-2 border-t border-slate-800/80">
                <label className="block text-slate-300 font-semibold">4. Backup Destination & Storage Target *</label>

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
            )}
          </div>

          {/* ================= RIGHT COLUMN: GENERATED OUTPUTS & INSTRUCTIONS (7 cols) ================= */}
          <div className="lg:col-span-7 flex flex-col h-full bg-slate-950/80">
            {/* Output Sub-Tabs */}
            <div className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900/40">
              <div className="flex items-center space-x-1 bg-slate-950 p-1 rounded-2xl border border-slate-800">
                <button
                  type="button"
                  onClick={() => setOutputTab('script')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition-colors ${
                    outputTab === 'script'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <FileCode className="h-3.5 w-3.5" />
                  <span>Full Script (.sh)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setOutputTab('command')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition-colors ${
                    outputTab === 'command'
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Terminal className="h-3.5 w-3.5" />
                  <span>1-Liner Run</span>
                </button>

                <button
                  type="button"
                  onClick={() => setOutputTab('preflight')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition-colors ${
                    outputTab === 'preflight'
                      ? 'bg-cyan-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Activity className="h-3.5 w-3.5" />
                  <span>🩺 Pre-Flight Check</span>
                </button>

                <button
                  type="button"
                  onClick={() => setOutputTab('crontab')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition-colors ${
                    outputTab === 'crontab'
                      ? 'bg-purple-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Clock className="h-3.5 w-3.5" />
                  <span>Crontab</span>
                </button>

                <button
                  type="button"
                  onClick={() => setOutputTab('prereq')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition-colors ${
                    outputTab === 'prereq'
                      ? 'bg-amber-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <ShieldCheck className="h-3.5 w-3.5" />
                  <span>Pre-requisites</span>
                </button>
              </div>

              {/* Action Buttons: Copy / Download */}
              <div className="flex items-center space-x-2">
                {outputTab === 'script' && (
                  <button
                    type="button"
                    onClick={handleDownloadScript}
                    className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 transition-colors shadow-sm"
                    title={`Download ${defaultScriptName}`}
                  >
                    <Download className="h-3.5 w-3.5 text-cyan-400" />
                    <span className="hidden sm:inline">Download .sh</span>
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
                      <span>Copy</span>
                    </>
                  )}
                </button>
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
                        <span>Target engine client: <code className="text-slate-200">{backupType === 'postgres' ? 'pg_dump & psql' : backupType === 'mysql' ? 'mysqldump & mysqladmin' : 'zip'}</code></span>
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
