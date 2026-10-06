import bcrypt from 'bcryptjs';
import { prisma } from '../db/prisma';
import { config } from '../config/env';

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function seedInitialAdmin(): Promise<void> {
  try {
    const userCount = await prisma.user.count();
    if (userCount === 0) {
      const hashedPassword = await hashPassword(config.INITIAL_ADMIN_PASSWORD);
      await prisma.user.create({
        data: {
          username: config.INITIAL_ADMIN_USERNAME,
          email: `${config.INITIAL_ADMIN_USERNAME}@example.com`,
          passwordHash: hashedPassword,
          role: 'admin',
        },
      });
      console.log(`[AUTH] Initial admin user created: ${config.INITIAL_ADMIN_USERNAME}`);
    }
  } catch (error) {
    console.error('[AUTH] Error checking/seeding initial admin:', error);
  }
}
