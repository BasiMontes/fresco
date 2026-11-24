#!/usr/bin/env bun
/**
 * Chaos: how long does the app's own Stripe client wait for a Stripe that never answers?
 * `bun run chaos:stripe-stall [--timeout-ms N] [--cap-seconds N]`
 *
 * FRESCO-1251, phase 3 (S1). The checkout route calls Stripe several times in a row (`app/api/stripe/checkout/route.ts`),
 * and the client is built with only `apiVersion` (`lib/stripe.ts`), so it runs on the SDK defaults. This script builds a
 * client with the SAME options, points it at a local socket that accepts the connection and never writes a byte, makes one
 * call and measures: how long until the SDK gives up, with what error, and how many connections it opened (1 plus its retries).
 *
 * With no arguments it measures the real configuration, which takes minutes. `--timeout-ms` overrides the SDK timeout so the
 * attempts and the error can be seen in seconds; the retry count it reveals is the same one the real configuration uses.
 * `--cap-seconds` (default 600) is how long to wait before reporting "still pending".
 *
 * It only ever talks to 127.0.0.1 and to a server it starts itself: no Stripe account, no key, no network. Read only for the
 * repo: it writes nothing. This script is project-owned, `bun run up` does not overwrite it.
 */

import type { AddressInfo, Socket } from 'node:net';
import { createServer } from 'node:net';
import process from 'node:process';

import Stripe from 'stripe';

import { STRIPE_API_VERSION } from '../../lib/stripe-api-version';

function numberArg(name: string): number | undefined {
  const index = process.argv.indexOf(name);
  if (index === -1) {
    return undefined;
  }
  const value = Number(process.argv[index + 1]);
  if (!Number.isFinite(value) || value <= 0) {
    console.error(`${name} needs a positive number`);
    process.exit(2);
  }
  return value;
}

const timeoutMs = numberArg('--timeout-ms');
const capSeconds = numberArg('--cap-seconds') ?? 600;

let connections = 0;
const sockets = new Set<Socket>();
const server = createServer((socket) => {
  connections++;
  sockets.add(socket);
  socket.on('error', () => {});
  // Accepts and never answers: the silent Stripe.
});
await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
const port = (server.address() as AddressInfo).port;

const stripe = new Stripe('sk_test_chaos_stall_dummy', {
  apiVersion: STRIPE_API_VERSION,
  host: '127.0.0.1',
  port,
  protocol: 'http',
  ...(timeoutMs === undefined ? {} : { timeout: timeoutMs }),
});

console.log(`Stripe client: timeout ${stripe.getApiField('timeout')} ms, max network retries ${stripe.getMaxNetworkRetries()}${timeoutMs === undefined ? ' (the real configuration)' : ' (timeout overridden)'}`);
console.log(`waiting for a Stripe that never answers, up to ${capSeconds} s...`);

const start = Date.now();
const outcome = await Promise.race([
  stripe.checkout.sessions.create({
    mode: 'subscription',
    line_items: [{ price: 'price_chaos_stall', quantity: 1 }],
    success_url: 'http://localhost:3000/profile?checkout=success',
    cancel_url: 'http://localhost:3000/profile?checkout=cancelled',
  }).then(
    () => 'it answered (unexpected)',
    (error: Error) => `gave up with ${error.constructor.name}: ${error.message}`,
  ),
  new Promise<string>((resolve) => { setTimeout(resolve, capSeconds * 1000, 'still pending'); }),
]);

console.log(`after ${((Date.now() - start) / 1000).toFixed(1)} s: ${outcome}`);
console.log(`connections opened: ${connections} (1 plus the retries)`);

for (const socket of sockets) {
  socket.destroy();
}
server.close();
process.exit(0);
