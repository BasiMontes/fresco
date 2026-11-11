import { describe, expect, test } from 'bun:test';
import { isTransientDatabaseError } from './db-errors';

/** FRESCO-1160 — which database failures the webhook answers 5xx for. */

describe('isTransientDatabaseError', () => {
  test.each([
    ['PostgREST cannot reach the database', { code: 'PGRST000', message: 'Could not connect with the database' }],
    ['PostgREST has no connection pool slot', { code: 'PGRST003', message: 'Timed out acquiring connection from connection pool' }],
    ['PostgREST has no schema cache yet', { code: 'PGRST002', message: 'Could not query the database for the schema cache' }],
    ['a connection exception', { code: '08006', message: 'connection failure' }],
    ['too many connections', { code: '53300', message: 'too many connections for role' }],
    ['a deadlock', { code: '40P01', message: 'deadlock detected' }],
    ['a serialization failure', { code: '40001', message: 'could not serialize access' }],
    ['a statement timeout', { code: '57014', message: 'canceling statement due to statement timeout' }],
    ['a failed fetch with no code', { code: '', message: 'TypeError: fetch failed' }],
    ['a dropped socket', Object.assign(new Error('read ECONNRESET'), { code: '' })],
    ['a gateway page in front of PostgREST', { message: '<html><head><title>502 Bad Gateway</title></head></html>' }],
    ['a 5xx status', { status: 503, message: 'x' }],
    ['a 429 status', { status: 429, message: 'x' }],
  ])('%s is transient', (_name, error) => {
    expect(isTransientDatabaseError(error)).toBe(true);
  });

  test.each([
    ['a unique violation', { code: '23505', message: 'duplicate key value violates unique constraint' }],
    ['a check violation', { code: '23514', message: 'new row violates check constraint' }],
    ['a row level security refusal', { code: '42501', message: 'permission denied for table user_profiles' }],
    ['a missing column', { code: '42703', message: 'column "x" does not exist' }],
    ['an invalid value', { code: '22P02', message: 'invalid input syntax for type uuid' }],
    ['a PostgREST bad request', { code: 'PGRST102', message: 'Empty or invalid json' }],
    ['a 4xx status', { status: 400, message: 'bad request' }],
    ['our own bug', new Error('activateProPlan matched no profile for user u1')],
    ['a plain bug', new TypeError('x is undefined')],
    ['a string', 'boom'],
    ['null', null],
  ])('%s is not transient: a retry would repeat it', (_name, error) => {
    expect(isTransientDatabaseError(error)).toBe(false);
  });
});
