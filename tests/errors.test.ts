import {
  AppError,
  BadRequest,
  Conflict,
  Forbidden,
  InternalServerError,
  NotFound,
  Unauthorized,
} from '../src/shared/utils/errors.js';

describe('AppError factories', () => {
  it('AppError carries status, code, message and optional details', () => {
    const err = new AppError(418, 'Teapot', 'short and stout', { foo: 'bar' });
    expect(err).toBeInstanceOf(Error);
    expect(err.statusCode).toBe(418);
    expect(err.code).toBe('Teapot');
    expect(err.message).toBe('short and stout');
    expect(err.details).toEqual({ foo: 'bar' });
  });

  it('maps each factory to its status code', () => {
    expect(BadRequest('x').statusCode).toBe(400);
    expect(Unauthorized().statusCode).toBe(401);
    expect(Forbidden().statusCode).toBe(403);
    expect(NotFound().statusCode).toBe(404);
    expect(Conflict('x').statusCode).toBe(409);
    expect(InternalServerError().statusCode).toBe(500);
  });

  it('uses default messages when none is given and custom ones when provided', () => {
    expect(Unauthorized().message).toBe('Unauthorized');
    expect(Unauthorized('nope').message).toBe('nope');
    expect(Forbidden().message).toBe('Forbidden');
    expect(NotFound().message).toBe('Not Found');
    expect(InternalServerError().message).toBe('Internal Server Error');
  });

  it('passes details through on BadRequest and Conflict', () => {
    expect(BadRequest('bad', { field: 'email' }).details).toEqual({ field: 'email' });
    expect(Conflict('dup', { field: 'username' }).details).toEqual({ field: 'username' });
  });
});
