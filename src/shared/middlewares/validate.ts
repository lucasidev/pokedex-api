import type { RequestHandler } from 'express';
import type { ZodSchema } from 'zod';
import { BadRequest } from '../utils/errors.js';

type Source = 'body' | 'params' | 'query';

interface ValidateSchemas {
  body?: ZodSchema;
  params?: ZodSchema;
  query?: ZodSchema;
}

export function validate(schemas: ValidateSchemas): RequestHandler {
  return (req, _res, next) => {
    for (const source of ['body', 'params', 'query'] as const) {
      const schema = schemas[source];
      if (!schema) continue;
      const parsed = schema.safeParse(req[source]);
      if (!parsed.success) {
        throw BadRequest('Invalid request', parsed.error.flatten());
      }
      // Body is plain JSON we own: overwrite with the parsed (and coerced)
      // value. Params and query are URL-derived and Express keeps them
      // read-only on some setups, so merge in place.
      assignParsed(req[source as Source], parsed.data, source);
    }
    next();
  };
}

function assignParsed(target: unknown, data: unknown, source: Source): void {
  if (source === 'body') {
    // body is always a plain object once express.json() ran
    Object.assign(target as object, data as object);
    return;
  }
  if (target && typeof target === 'object' && data && typeof data === 'object') {
    Object.assign(target as object, data as object);
  }
}
