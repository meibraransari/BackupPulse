import { PrismaClient } from '@prisma/client';
import { config } from '../config/env';

// Handle BigInt serialization in JSON responses
(BigInt.prototype as any).toJSON = function () {
  return Number(this);
};

export const prisma = new PrismaClient({
  log: config.ENABLE_CONSOLE_LOG
    ? [
        { emit: 'stdout', level: 'warn' },
        { emit: 'stdout', level: 'error' },
        { emit: 'stdout', level: 'info' },
      ]
    : [{ emit: 'stdout', level: 'error' }],
});
