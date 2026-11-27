import type { ErrorEvent, init } from '@sentry/nextjs';
import { scrubUrlToken } from '@/lib/observability/scrub-url-token';

// Derived from what `@sentry/nextjs` exports: `@sentry/core` is not a dependency of this app.
type InitOptions = NonNullable<Parameters<typeof init>[0]>;
type Integration = Extract<NonNullable<InitOptions['integrations']>, unknown[]>[number];
type Client = Parameters<NonNullable<Integration['setup']>>[0];
type StreamedSpanJSON = Parameters<NonNullable<InitOptions['beforeSendSpan']>>[0];

/** A copy of `value` with the URL `token` blanked in every string, at any depth. */
function scrubDeep(value: unknown, seen = new Map<object, unknown>()): unknown {
  if (typeof value === 'string') {
    return scrubUrlToken(value);
  }
  const isPlain = Array.isArray(value)
    || (typeof value === 'object' && value !== null && [Object.prototype, null].includes(Object.getPrototypeOf(value)));
  if (!isPlain) {
    return value;
  }
  const source = value as object;
  if (seen.has(source)) {
    return seen.get(source);
  }
  const copy = (Array.isArray(source) ? [] : {}) as Record<string, unknown>;
  seen.set(source, copy);
  for (const [key, entry] of Object.entries(source)) {
    copy[key] = scrubDeep(entry, seen);
  }
  return copy;
}

/** `query_string` may also arrive already parsed, where no string carries the `token=` prefix. */
function scrubParsedQuery(query: NonNullable<ErrorEvent['request']>['query_string']) {
  if (Array.isArray(query)) {
    return query.map(([key, value]): [string, string] => [key, key.toLowerCase() === 'token' ? 'redacted' : value]);
  }
  if (typeof query === 'object' && query !== null) {
    return Object.fromEntries(Object.entries(query).map(([key, value]) => [key, key.toLowerCase() === 'token' ? 'redacted' : value]));
  }
  return query;
}

/**
 * The trace header of every envelope (and the `baggage` of outgoing requests) repeats the root span's name, and
 * passes through neither callback below.
 */
const scrubTraceHeader = {
  name: 'ScrubUrlTokenTraceHeader',
  setup(client: Client) {
    client.on('createDsc', (dsc) => {
      if (dsc.transaction) {
        dsc.transaction = scrubUrlToken(dsc.transaction);
      }
    });
  },
};

/**
 * A8-API-01 / FRESCO-1305: the waitlist link's token travels in the page URL; keep it out of Sentry. Shared by the
 * browser, server and edge clients. Spans need `beforeSendSpan`: with the default `traceLifecycle: 'stream'` the SDK
 * ignores `beforeSendTransaction`.
 */
export const sentryScrubbing = {
  integrations: [scrubTraceHeader],
  beforeSend(event: ErrorEvent): ErrorEvent {
    const scrubbed = scrubDeep(event) as ErrorEvent;
    if (scrubbed.request?.query_string) {
      scrubbed.request.query_string = scrubParsedQuery(scrubbed.request.query_string);
    }
    return scrubbed;
  },
  beforeSendSpan(span: StreamedSpanJSON): StreamedSpanJSON {
    return scrubDeep(span) as StreamedSpanJSON;
  },
};
