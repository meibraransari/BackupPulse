import { FastifyInstance } from 'fastify';
import { register, refreshDynamicMetrics } from '../services/metrics.service';

export async function metricsRoutes(fastify: FastifyInstance) {
  fastify.get(
    '/metrics',
    {
      schema: {
        description: 'Expose Prometheus telemetry and system metrics in standard text exposition format',
        tags: ['Metrics'],
        response: {
          200: {
            type: 'string',
          },
        },
      },
    },
    async (_request, reply) => {
      await refreshDynamicMetrics();
      const metricsText = await register.metrics();
      return reply
        .header('Content-Type', register.contentType)
        .send(metricsText);
    }
  );
}
