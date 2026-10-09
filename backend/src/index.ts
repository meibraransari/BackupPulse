import Fastify, { FastifyReply, FastifyRequest } from 'fastify';
import cors from '@fastify/cors';
import fastifyJwt from '@fastify/jwt';
import fastifyStatic from '@fastify/static';
import rateLimit from '@fastify/rate-limit';
import path from 'path';
import fs from 'fs';

import { config } from './config/env';
import { setupSwagger } from './swagger';
import { seedInitialAdmin } from './services/auth.service';
import { initCronJobs } from './services/cron.service';
import { initSettings } from './services/settings.service';

import { healthRoutes } from './routes/health.route';
import { authRoutes } from './routes/auth.route';
import { backupRoutes } from './routes/backup.route';
import { dashboardRoutes } from './routes/dashboard.route';
import { notificationRoutes } from './routes/notification.route';
import { systemRoutes } from './routes/system.route';
import { serverRoutes } from './routes/server.route';
import { userRoutes } from './routes/user.route';
import { apiKeyRoutes } from './routes/apikey.route';
import { metricsRoutes } from './routes/metrics.route';
import { scriptRoutes } from './routes/script.route';
import { settingsRoutes } from './routes/settings.route';

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

  // Support empty JSON bodies gracefully without throwing FST_ERR_CTP_EMPTY_JSON_BODY
  fastify.addContentTypeParser('application/json', { parseAs: 'string' }, (_req, body: string | Buffer, done) => {
    const str = typeof body === 'string' ? body : body?.toString('utf-8') || '';
    if (!str || str.trim() === '') {
      return done(null, {});
    }
    try {
      const json = JSON.parse(str);
      done(null, json);
    } catch (err: any) {
      err.statusCode = 400;
      done(err, undefined);
    }
  });

  // Register Global Rate Limiting
  await fastify.register(rateLimit, {
    max: 300,
    timeWindow: '1 minute',
    errorResponseBuilder: (_req, context) => ({
      statusCode: 429,
      error: 'Too Many Requests',
      message: `Rate limit exceeded. Exceeded ${context.max} requests within ${context.after}. Please slow down your requests.`,
    }),
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

  // Setup Swagger Documentation at /api/docs if enabled
  if (config.ENABLE_SWAGGER) {
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

    await setupSwagger(fastify);
  } else {
    // When Swagger is disabled in production, block /api/docs and /docs with 404
    const handleDisabledDocs = async (_request: FastifyRequest, reply: FastifyReply) => {
      return reply.status(404).send({
        error: 'Not Found',
        message: 'Swagger API documentation is disabled in this environment (ENABLE_SWAGGER=false).',
      });
    };

    fastify.get('/api/docs', handleDisabledDocs);
    fastify.get('/api/docs/*', handleDisabledDocs);
    fastify.get('/docs', handleDisabledDocs);
    fastify.get('/docs/*', handleDisabledDocs);
  }

  // Register API Routes
  await fastify.register(healthRoutes);
  await fastify.register(authRoutes);
  await fastify.register(backupRoutes);
  await fastify.register(dashboardRoutes);
  await fastify.register(notificationRoutes);
  await fastify.register(systemRoutes);
  await fastify.register(serverRoutes);
  await fastify.register(userRoutes);
  await fastify.register(apiKeyRoutes);
  await fastify.register(metricsRoutes);
  await fastify.register(scriptRoutes);
  await fastify.register(settingsRoutes);

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
      if (!request.raw.url?.startsWith('/api') && !request.raw.url?.startsWith('/health') && !request.raw.url?.startsWith('/metrics')) {
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
    console.log(`📊 Prometheus Metrics: http://${config.HOST}:${config.PORT}/metrics`);
    console.log(`📖 Swagger API Docs: ${config.ENABLE_SWAGGER ? `http://${config.HOST}:${config.PORT}/api/docs/` : 'DISABLED (ENABLE_SWAGGER=false)'}`);
    console.log(`💓 Health Check: http://${config.HOST}:${config.PORT}/health`);
    console.log(`📝 Console Logging: ${config.ENABLE_CONSOLE_LOG ? 'ENABLED (' + config.LOG_LEVEL + ')' : 'DISABLED'}`);
    console.log(`====================================================`);

    // Initialize database-backed dynamic system settings
    await initSettings();

    // Seed admin user and start background cron
    await seedInitialAdmin();
    initCronJobs();
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

bootstrap();
