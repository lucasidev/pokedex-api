import pino from 'pino';
import { env } from '../config/env.js';

const isProd = env.NODE_ENV === 'production';

export const logger = pino({
  level: env.LOG_LEVEL,
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers["x-access-token"]',
      'req.headers.cookie',
      '*.password',
      '*.token',
    ],
    remove: true,
  },
  ...(isProd
    ? {}
    : {
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:HH:MM:ss',
            ignore: 'pid,hostname',
          },
        },
      }),
});
