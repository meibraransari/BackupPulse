import Fastify, { FastifyReply, FastifyRequest } from 'fastify';
import cors from '@fastify/cors';
import fastifyJwt from '@fastify/jwt';
import fastifyStatic from '@fastify/static';
import path from 'path';
import fs from 'fs';

import { config } from './config/env';
import { setupSwagger } from './swagger';
import { seedInitialAdmin } from './services/auth.service';
import { initCronJobs } from './services/cron.service';

import { healthRoutes } from './routes/health.route';
import { authRoutes } from './routes/auth.route';
import { backupRoutes } from './routes/backup.route';
import { dashboardRoutes } from './routes/dashboard.route';
import { notificationRoutes } from './routes/notification.route';

async function bootstrap() {
  const fastify = Fastify({
    logger: config.NODE_ENV === 'development',
    bodyLimit: 15 * 1024 * 1024, // 15MB limit for large logs if needed
  });

  // Enable CORS
  await fastify.register(cors, {
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  });

  // Enable JWT
  await fastify.register(fastifyJwt, {
    secret: config.JWT_SECRET,
  });

  // Decorate authentication hook
  fastify.decorate('authenticate', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await request.jwtVerify();
    } catch (err) {
      reply.status(401).send({ error: 'Unauthorized: Invalid or missing token' });
    }
  });

  // Setup Swagger Documentation at /api/docs
  await setupSwagger(fastify);

  // Register Routes
  await fastify.register(healthRoutes);
  await fastify.register(authRoutes);
  await fastify.register(backupRoutes);
  await fastify.register(dashboardRoutes);
  await fastify.register(notificationRoutes);

  // Serve static frontend build if present (for single container deployment)
  const frontendDistPath = path.resolve(__dirname, '../../frontend/dist');
  if (fs.existsSync(frontendDistPath)) {
    console.log(`[STATIC] Serving frontend static assets from: ${frontendDistPath}`);
    await fastify.register(fastifyStatic, {
      root: frontendDistPath,
      prefix: '/',
      wildcard: false,
    });

    // SPA fallback: redirect non-API GET requests to index.html
    fastify.setNotFoundHandler((request, reply) => {
      if (!request.raw.url?.startsWith('/api') && !request.raw.url?.startsWith('/health')) {
        return reply.sendFile('index.html');
      }
      reply.status(404).send({ error: 'Route not found' });
    });
  }

  // Graceful shutdown
  const closeSignals: NodeJS.Signals[] = ['SIGINT', 'SIGTERM'];
  closeSignals.forEach((signal) => {
    process.on(signal, async () => {
      console.log(`\nReceived ${signal}. Gracefully shutting down...`);
      await fastify.close();
      process.exit(0);
    });
  });

  try {
    await fastify.listen({ port: config.PORT, host: config.HOST });
    console.log(`====================================================`);
    console.log(`🚀 Backup Monitoring Server is running!`);
    console.log(`📍 Base URL: http://${config.HOST}:${config.PORT}`);
    console.log(`📖 Swagger API Docs: http://${config.HOST}:${config.PORT}/api/docs`);
    console.log(`💓 Health Check: http://${config.HOST}:${config.PORT}/health`);
    console.log(`====================================================`);

    // Seed admin user and start background cron
    await seedInitialAdmin();
    initCronJobs();
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

bootstrap();
