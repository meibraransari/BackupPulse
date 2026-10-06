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
  // Fastify logger configuration across all modes
  const fastify = Fastify({
    logger: config.ENABLE_CONSOLE_LOG
      ? {
          level: config.LOG_LEVEL,
        }
      : false,
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

  // Global console request logging for all modes (production & development)
  if (config.ENABLE_CONSOLE_LOG) {
    fastify.addHook('onResponse', (request, reply, done) => {
      const responseTime = Math.round(reply.elapsedTime);
      const status = reply.statusCode;
      const statusColor = status >= 500 ? '❌' : status >= 400 ? '⚠️' : '✅';
      console.log(
        `[HTTP] ${new Date().toISOString()} ${statusColor} | ${request.method} ${request.url} -> ${status} (${responseTime}ms)`
      );
      done();
    });
  }

  // Pre-routing hook to fix Swagger-UI relative paths & aliases
  fastify.addHook('onRequest', async (request, reply) => {
    const rawUrl = request.raw.url || '';

    // 1. Fix duplicate /api/api/docs/ prefix if requested
    if (rawUrl.startsWith('/api/api/docs/')) {
      const fixedUrl = rawUrl.replace('/api/api/docs/', '/api/docs/');
      return reply.redirect(302, fixedUrl);
    }

    // 2. Redirect /api/docs (without trailing slash) to /api/docs/ (with trailing slash)
    // This is required so Swagger-UI resolves relative assets like ./static/swagger-ui.css correctly
    if (rawUrl === '/api/docs' || rawUrl.startsWith('/api/docs?')) {
      const query = rawUrl.includes('?') ? rawUrl.substring(rawUrl.indexOf('?')) : '';
      return reply.redirect(302, `/api/docs/${query}`);
    }

    // 3. User-friendly alias: /docs or /docs/ redirects to /api/docs/
    if (rawUrl === '/docs' || rawUrl === '/docs/' || rawUrl.startsWith('/docs?') || rawUrl.startsWith('/docs/?')) {
      const query = rawUrl.includes('?') ? rawUrl.substring(rawUrl.indexOf('?')) : '';
      return reply.redirect(302, `/api/docs/${query}`);
    }
  });

  // Setup Swagger Documentation at /api/docs
  await setupSwagger(fastify);

  // Register API Routes
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
    console.log(`🚀 BackupPulse Monitoring Server is LIVE!`);
    console.log(`📍 Web Dashboard: http://${config.HOST}:${config.PORT}`);
    console.log(`📖 Swagger API Docs: http://${config.HOST}:${config.PORT}/api/docs/`);
    console.log(`💓 Health Check: http://${config.HOST}:${config.PORT}/health`);
    console.log(`📝 Console Logging: ${config.ENABLE_CONSOLE_LOG ? 'ENABLED (' + config.LOG_LEVEL + ')' : 'DISABLED'}`);
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
