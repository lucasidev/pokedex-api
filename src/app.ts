import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { env } from './config/env.js';
import { logger } from './lib/logger.js';
import { errorHandler, notFoundHandler } from './middlewares/error.js';
import { metricsMiddleware } from './middlewares/metrics.js';
import authRoutes from './routes/auth.routes.js';
import healthRoutes from './routes/health.routes.js';
import indexRoutes from './routes/index.routes.js';
import metricsRoutes from './routes/metrics.routes.js';
import pokemonRoutes from './routes/pokemon.routes.js';
import userRoutes from './routes/user.routes.js';

const app = express();

app.use(helmet());
app.use(
  cors({
    origin: env.CORS_ORIGIN,
    credentials: true,
    allowedHeaders: ['Authorization', 'Content-Type', 'Accept', 'x-access-token'],
  }),
);
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
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

app.use('/api', indexRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/pokemon', pokemonRoutes);

app.use(notFoundHandler);
app.use(errorHandler);

export default app;
