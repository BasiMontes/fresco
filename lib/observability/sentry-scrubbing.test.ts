import * as Sentry from '@sentry/bun';
import { afterAll, describe, expect, test } from 'bun:test';
import { sentryScrubbing } from './sentry-scrubbing';

const TOKEN = 'f3a9c1d2e4b5a6978877665544332211';
const URL_WITH_TOKEN = `https://fresco-pro.vercel.app/lista-de-espera?token=${TOKEN}&accion=confirmar`;

/**
 * FRESCO-1305: a real SDK client with a transport that records instead of sending, so the test fails if the
 * installed SDK stops calling one of the callbacks (Sentry 11 ignores `beforeSendTransaction`).
 */
async function sendThroughSdk(capture: () => void): Promise<string> {
  const sent: unknown[] = [];
  Sentry.init({
    dsn: 'https://key@o1.ingest.de.sentry.io/1',
    defaultIntegrations: false,
    tracesSampleRate: 1,
    transport: () => ({
      send: async (envelope: unknown) => {
        sent.push(envelope);
        return {};
      },
      flush: async () => true,
    }),
    ...sentryScrubbing,
  });
  capture();
  await Sentry.flush(2000);
  return JSON.stringify(sent);
}

afterAll(async () => {
  await Sentry.close();
});

describe('sentryScrubbing', () => {
  test('a span carrying the token in its name and attributes leaves redacted', async () => {
    const sent = await sendThroughSdk(() => {
      Sentry.startSpan(
        { name: `GET ${URL_WITH_TOKEN}`, attributes: { 'url.full': URL_WITH_TOKEN, 'url.query': `token=${TOKEN}` } },
        () => Sentry.startSpan({ name: 'fetch', attributes: { 'http.url': URL_WITH_TOKEN } }, () => {}),
      );
    });

    expect(sent).toContain('token=redacted');
    expect(sent).not.toContain(TOKEN);
  });

  test('an error leaves with the token redacted in the request and the breadcrumbs', async () => {
    const sent = await sendThroughSdk(() => {
      Sentry.captureEvent({
        message: 'boom',
        request: { url: URL_WITH_TOKEN, query_string: `token=${TOKEN}`, headers: { referer: URL_WITH_TOKEN } },
        breadcrumbs: [{ category: 'navigation', data: { from: '/', to: URL_WITH_TOKEN } }],
      });
    });

    expect(sent).toContain('token=redacted');
    expect(sent).not.toContain(TOKEN);
  });

  test('a query string given as an object or as pairs is redacted too', () => {
    const asObject = sentryScrubbing.beforeSend({ type: undefined, request: { query_string: { token: TOKEN, accion: 'baja' } } });
    const asPairs = sentryScrubbing.beforeSend({ type: undefined, request: { query_string: [['token', TOKEN], ['accion', 'baja']] } });

    expect(asObject.request?.query_string).toEqual({ token: 'redacted', accion: 'baja' });
    expect(asPairs.request?.query_string).toEqual([['token', 'redacted'], ['accion', 'baja']]);
  });

  test('the token_hash of an auth email link is redacted in spans, errors and parsed queries', async () => {
    const link = `https://fresco-pro.vercel.app/auth/confirm?token_hash=${TOKEN}&type=recovery`;
    const sent = await sendThroughSdk(() => {
      Sentry.startSpan({ name: `GET ${link}`, attributes: { 'url.full': link, 'url.query': `token_hash=${TOKEN}` } }, () => {});
      Sentry.captureEvent({ message: 'boom', request: { url: link } });
    });
    const parsed = sentryScrubbing.beforeSend({ type: undefined, request: { query_string: { token_hash: TOKEN, type: 'recovery' } } });

    expect(sent).toContain('token_hash=redacted&type=recovery');
    expect(sent).not.toContain(TOKEN);
    expect(parsed.request?.query_string).toEqual({ token_hash: 'redacted', type: 'recovery' });
  });

  test('values without a token come back unchanged', () => {
    const event = { type: undefined, message: 'token expired', request: { url: 'https://fresco-pro.vercel.app/recetas?q=token' }, extra: { attempts: 2 } };

    expect(sentryScrubbing.beforeSend(structuredClone(event))).toEqual(event);
  });
});
