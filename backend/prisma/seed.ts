import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { config } from '../src/config/env';

const prisma = new PrismaClient();

async function main() {
  console.log('[SEED] Seeding database...');

  // Admin user
  const hashedPassword = await bcrypt.hash(config.INITIAL_ADMIN_PASSWORD, 10);
  const user = await prisma.user.upsert({
    where: { username: config.INITIAL_ADMIN_USERNAME },
    update: {},
    create: {
      username: config.INITIAL_ADMIN_USERNAME,
      email: `${config.INITIAL_ADMIN_USERNAME}@company.internal`,
      passwordHash: hashedPassword,
      role: 'admin',
    },
  });
  console.log(`[SEED] Admin user ensured: ${user.username}`);

  // Seed some realistic mock backup reports if empty, to ensure the dashboard has immediate data
  const reportCount = await prisma.backupReport.count();
  if (reportCount === 0) {
    console.log('[SEED] Seeding sample backup reports for initial dashboard visualization...');
    const sampleProjects = ['ecommerce-core', 'payment-gateway', 'user-service', 'inventory-db', 'notification-engine'];
    const servers = ['srv-us-east-01', 'srv-us-east-02', 'srv-eu-west-01', 'srv-ap-south-01', 'srv-ap-south-02'];
    const types = ['db', 'code', 'full'];

    for (let i = 0; i < 25; i++) {
      const proj = sampleProjects[i % sampleProjects.length];
      const srv = servers[i % servers.length];
      const type = types[i % types.length];
      const isFailed = i === 4 || i === 12; // 2 failures for realism
      const hoursAgo = i * 2;
      const startTime = new Date(Date.now() - hoursAgo * 3600 * 1000 - 300 * 1000);
      const endTime = new Date(Date.now() - hoursAgo * 3600 * 1000);
      const sizeBytes = BigInt(Math.floor(100 * 1024 * 1024 + Math.random() * 2 * 1024 * 1024 * 1024));

      await prisma.backupReport.create({
        data: {
          serverId: srv,
          hostname: `${srv}.cloud.internal`,
          serverIp: `10.0.1.${10 + i}`,
          projectName: proj,
          environment: 'production',
          backupType: type,
          status: isFailed ? 'FAILED' : 'SUCCESS',
          startTime,
          endTime,
          durationSeconds: isFailed ? 45 : 300 + Math.floor(Math.random() * 200),
          backupSizeBytes: isFailed ? BigInt(0) : sizeBytes,
          backupSizeHuman: isFailed ? '0 B' : `${(Number(sizeBytes) / (1024 * 1024 * 1024)).toFixed(2)} GB`,
          s3Bucket: 'company-backup-vault-prod',
          s3Key: `${proj}/2026-10-06/${proj}_backup_${Date.now() - i * 10000}.tar.gz`,
          s3Url: `s3://company-backup-vault-prod/${proj}/2026-10-06/${proj}_backup.tar.gz`,
          checksum: isFailed ? null : 'a8f5f167f44f4964e6c998dee827110c',
          zipFilename: `${proj}_backup_${Date.now() - i * 10000}.tar.gz`,
          exitCode: isFailed ? 1 : 0,
          errorMessage: isFailed ? 'mysqldump: Got errno 28 (No space left on device) during table dump' : null,
          stdoutLog: isFailed ? 'Archive creation started.\nDatabase dump initiated.' : 'Archive verified.\nChecksum: SHA256 matches.\nUploaded to S3 successfully.',
          stderrLog: isFailed ? 'ERROR 2002 (HY000): Can\'t connect to local MySQL server through socket' : null,
          createdAt: endTime,
        },
      });
    }
    console.log('[SEED] Sample backup reports created successfully.');
  }

  const notifLogCount = await prisma.notificationLog.count();
  if (notifLogCount === 0) {
    console.log('[SEED] Seeding sample notification delivery log...');
    await prisma.notificationLog.create({
      data: {
        channel: 'GOOGLE_CHAT',
        eventType: 'TEST_NOTIFICATION',
        recipient: 'Google Chat Space Webhook',
        status: 'SUCCESS',
        message: 'Initial system deployment test alert recorded.',
        payload: { initialSetup: true },
      },
    });
  }

  console.log('[SEED] Seeding completed.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
