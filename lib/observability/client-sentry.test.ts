import { describe, expect, mock, test } from 'bun:test';
import { createClientSentry } from './client-sentry';

function fakeSdk() {
  return {
    init: mock(() => {}),
    close: mock(async () => true),
    captureRouterTransitionStart: mock(() => {}),
  };
}

/** FRESCO-1042 / ADR-0065: nothing is loaded or initialised before `start()`. */
describe('createClientSentry', () => {
  test('does not load the SDK until start() is called', () => {
    const loadSdk = mock(async () => fakeSdk() as never);
    const client = createClientSentry(loadSdk, 'https://key@o1.ingest.de.sentry.io/1');

    expect(loadSdk).not.toHaveBeenCalled();
    expect(client.current).toBeNull();
  });

  test('start() initialises the SDK once, even when called twice', async () => {
    const sdk = fakeSdk();
    const loadSdk = mock(async () => sdk as never);
    const client = createClientSentry(loadSdk, 'https://key@o1.ingest.de.sentry.io/1');

    await client.start();
    await client.start();

    expect(loadSdk).toHaveBeenCalledTimes(1);
    expect(sdk.init).toHaveBeenCalledTimes(1);
  });

  test('without a DSN it never loads the SDK', () => {
    const loadSdk = mock(async () => fakeSdk() as never);
    const client = createClientSentry(loadSdk, undefined);

    expect(client.start()).toBeNull();
    expect(loadSdk).not.toHaveBeenCalled();
  });

  test('stop() closes the client and a later start() initialises a new one', async () => {
    const sdk = fakeSdk();
    const client = createClientSentry(async () => sdk as never, 'https://key@o1.ingest.de.sentry.io/1');

    await client.start();
    await client.stop();
    expect(sdk.close).toHaveBeenCalledTimes(1);
    expect(client.current).toBeNull();

    await client.start();
    expect(sdk.init).toHaveBeenCalledTimes(2);
  });

  test('stop() before any start() does nothing', async () => {
    const sdk = fakeSdk();
    const client = createClientSentry(async () => sdk as never, 'https://key@o1.ingest.de.sentry.io/1');

    await client.stop();
    expect(sdk.close).not.toHaveBeenCalled();
  });
});
