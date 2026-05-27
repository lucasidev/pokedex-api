import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import authRoutes from './auth/auth.routes.js';
import pokemonRoutes from './pokemon/pokemon.routes.js';
import { env } from './shared/config/env.js';
import { logger } from './shared/infra/logger.js';
import { errorHandler, notFoundHandler } from './shared/middlewares/error.js';
import { metricsMiddleware } from './shared/middlewares/metrics.js';
import healthRoutes from './system/health.routes.js';
import metricsRoutes from './system/metrics.routes.js';
import welcomeRoutes from './system/welcome.routes.js';
import userRoutes from './users/users.routes.js';

const app = express();

app.use(helmet());
app.use(
  cors({
    origin: env.CORS_ORIGIN,
    credentials: true,
    allowedHeaders: ['Authorization', 'Content-Type', 'Accept', 'x-access-token'],
  }),
);
app.use(express.json({ limit: '20kb' }));
app.use(pinoHttp({ logger }));
app.use(metricsMiddleware);

app.use(healthRoutes);
app.use(metricsRoutes);

const apiLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  max: env.RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api', apiLimiter);

// Tighter limiter for credentials endpoints: 10 requests per 5 minutes
// per IP defeats casual brute force without inconveniencing real users.
// Disabled in tests so the suite can register many users from 127.0.0.1.
const authLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => env.NODE_ENV === 'test',
  message: { status: 'Too Many Requests', code: 429, message: 'Too many auth attempts' },
});

app.use('/api', welcomeRoutes);
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/pokemon', pokemonRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
