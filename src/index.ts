import app from './app.js';
import { env } from './config/env.js';
import { connectDatabase, disconnectDatabase } from './lib/database.js';
import { logger } from './lib/logger.js';
import { runInitialSetup } from './utils/initialSetup.js';

async function bootstrap(): Promise<void> {
  await connectDatabase();
  await runInitialSetup();

  const server = app.listen(env.PORT, () => {
    logger.info({ port: env.PORT, env: env.NODE_ENV }, 'pokedex-api listening');
  });

  const shutdown = async (signal: string): Promise<void> => {
    logger.info({ signal }, 'graceful shutdown started');
    server.close(async () => {
      await disconnectDatabase();
      logger.info('graceful shutdown complete');
      process.exit(0);
    });

    setTimeout(() => {
      logger.error('forced shutdown after timeout');
      process.exit(1);
    }, 10_000).unref();
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

bootstrap().catch((error: unknown) => {
  logger.fatal({ err: error }, 'bootstrap failed');
  process.exit(1);
});
