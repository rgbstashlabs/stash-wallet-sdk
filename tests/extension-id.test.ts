import { afterEach, describe, expect, it } from 'vitest';
import {
  normalizeExtensionId,
  resolveExtensionId,
  type ExtensionIdWindow,
} from '../src/transports/extension-id';
import { ChromeExtensionTransport } from '../src/transports/chrome-extension';
import { TransportError } from '../src/errors';

/**
 * The package runs in the `node` environment, so these tests install a plain-object
 * fake `window` (the resolver only reads properties) and remove it afterwards.
 *
 * The regression this file guards: a page served by RGBDEX has no
 * `window.__stashwallet` marker, only the server-injected
 * `window.__ENV__.VITE_STASH_WALLET_EXTENSION_ID`. Before the fix the official
 * transport reported EXTENSION_NOT_FOUND on exactly those pages.
 */

const ENV_ID = 'env-env-env-env-env-env-env-env-env';
const MARKER_ID = 'marker-mark-marker-mark-marker-mark';
const OVERRIDE_ID = 'overrid-overrid-overrid-overrid-ov';
const NODE_ID = 'legacy-legacy-legacy-legacy-legacy';

type FakeWindow = ExtensionIdWindow;

const globalWithWindow = globalThis as unknown as { window?: FakeWindow };

function setWindow(value: FakeWindow | undefined): void {
  if (value === undefined) {
    delete globalWithWindow.window;
    return;
  }
  globalWithWindow.window = value;
}

afterEach(() => {
  setWindow(undefined);
  delete (globalThis as unknown as { chrome?: unknown }).chrome;
});

describe('resolveExtensionId — individual sources', () => {
  it('reads the content-script marker', () => {
    setWindow({ __stashwallet: { id: MARKER_ID } });
    expect(resolveExtensionId()).toBe(MARKER_ID);
  });

  it('reads the manual page override', () => {
    setWindow({ __STASH_WALLET_EXTENSION_ID: OVERRIDE_ID });
    expect(resolveExtensionId()).toBe(OVERRIDE_ID);
  });

  it('reads the server-injected env whitelist (the RGBDEX regression)', () => {
    setWindow({ __ENV__: { VITE_STASH_WALLET_EXTENSION_ID: ENV_ID } });
    expect(resolveExtensionId()).toBe(ENV_ID);
  });

  it('still reads the legacy node extension id as the last resort', () => {
    setWindow({ __STASH_NODE_EXTENSION_ID: NODE_ID });
    expect(resolveExtensionId()).toBe(NODE_ID);
  });

  it('returns undefined when window is missing entirely', () => {
    setWindow(undefined);
    expect(resolveExtensionId()).toBeUndefined();
  });

  it('returns undefined when window exists but carries no marker', () => {
    setWindow({});
    expect(resolveExtensionId()).toBeUndefined();
  });
});

describe('resolveExtensionId — precedence', () => {
  it('prefers the marker over every lower source', () => {
    setWindow({
      __stashwallet: { id: MARKER_ID },
      __STASH_WALLET_EXTENSION_ID: OVERRIDE_ID,
      __ENV__: { VITE_STASH_WALLET_EXTENSION_ID: ENV_ID },
      __STASH_NODE_EXTENSION_ID: NODE_ID,
    });
    expect(resolveExtensionId()).toBe(MARKER_ID);
  });

  it('prefers the manual override over the env whitelist', () => {
    setWindow({
      __STASH_WALLET_EXTENSION_ID: OVERRIDE_ID,
      __ENV__: { VITE_STASH_WALLET_EXTENSION_ID: ENV_ID },
      __STASH_NODE_EXTENSION_ID: NODE_ID,
    });
    expect(resolveExtensionId()).toBe(OVERRIDE_ID);
  });

  it('prefers the env whitelist over the legacy node id', () => {
    setWindow({
      __ENV__: { VITE_STASH_WALLET_EXTENSION_ID: ENV_ID },
      __STASH_NODE_EXTENSION_ID: NODE_ID,
    });
    expect(resolveExtensionId()).toBe(ENV_ID);
  });
});

describe('resolveExtensionId — value validation', () => {
  it('rejects a whitespace-only marker and falls back', () => {
    setWindow({
      __stashwallet: { id: '   ' },
      __ENV__: { VITE_STASH_WALLET_EXTENSION_ID: ENV_ID },
    });
    expect(resolveExtensionId()).toBe(ENV_ID);
  });

  it('rejects a whitespace-only env value', () => {
    setWindow({ __ENV__: { VITE_STASH_WALLET_EXTENSION_ID: '   ' } });
    expect(resolveExtensionId()).toBeUndefined();
  });

  it('rejects whitespace-only values at every level', () => {
    setWindow({
      __stashwallet: { id: ' ' },
      __STASH_WALLET_EXTENSION_ID: '  ',
      __ENV__: { VITE_STASH_WALLET_EXTENSION_ID: '   ' },
      __STASH_NODE_EXTENSION_ID: '    ',
    });
    expect(resolveExtensionId()).toBeUndefined();
  });

  it('trims surrounding whitespace', () => {
    setWindow({ __ENV__: { VITE_STASH_WALLET_EXTENSION_ID: `  ${ENV_ID}\t` } });
    expect(resolveExtensionId()).toBe(ENV_ID);
  });

  it('treats a missing __ENV__ key as absent', () => {
    setWindow({ __ENV__: {} });
    expect(resolveExtensionId()).toBeUndefined();
  });

  it('treats an undefined env value as absent', () => {
    setWindow({ __ENV__: { VITE_STASH_WALLET_EXTENSION_ID: undefined } });
    expect(resolveExtensionId()).toBeUndefined();
  });

  it('treats a null __ENV__ as absent', () => {
    setWindow({ __ENV__: null });
    expect(resolveExtensionId()).toBeUndefined();
  });

  it('treats a non-object __ENV__ as absent without throwing', () => {
    const nonObjects: unknown[] = ['env-id-string', 0, 42, true];
    for (const value of nonObjects) {
      setWindow({ __ENV__: value });
      expect(resolveExtensionId()).toBeUndefined();
    }
  });

  it('treats non-string env values as absent without throwing', () => {
    const nonStrings: unknown[] = [{ id: ENV_ID }, 42, true, ['id'], () => ENV_ID];
    for (const value of nonStrings) {
      setWindow({ __ENV__: { VITE_STASH_WALLET_EXTENSION_ID: value } });
      expect(resolveExtensionId()).toBeUndefined();
    }
  });

  it('skips a non-string env value and still uses the legacy fallback', () => {
    setWindow({
      __ENV__: { VITE_STASH_WALLET_EXTENSION_ID: 12345 },
      __STASH_NODE_EXTENSION_ID: NODE_ID,
    });
    expect(resolveExtensionId()).toBe(NODE_ID);
  });

  it('treats a non-string marker as absent', () => {
    setWindow({ __stashwallet: { id: 42 }, __STASH_WALLET_EXTENSION_ID: OVERRIDE_ID });
    expect(resolveExtensionId()).toBe(OVERRIDE_ID);
  });
});

describe('normalizeExtensionId', () => {
  it('only accepts non-empty strings', () => {
    expect(normalizeExtensionId(ENV_ID)).toBe(ENV_ID);
    expect(normalizeExtensionId(` ${ENV_ID} `)).toBe(ENV_ID);
    expect(normalizeExtensionId('')).toBeUndefined();
    expect(normalizeExtensionId('   ')).toBeUndefined();
    expect(normalizeExtensionId(undefined)).toBeUndefined();
    expect(normalizeExtensionId(null)).toBeUndefined();
    expect(normalizeExtensionId(123)).toBeUndefined();
    expect(normalizeExtensionId({ id: ENV_ID })).toBeUndefined();
  });
});

describe('ChromeExtensionTransport integration with __ENV__', () => {
  interface ChromeStub {
    runtime: {
      sendMessage: (
        extensionId: string,
        message: unknown,
        callback: (response: unknown) => void,
      ) => void;
    };
  }

  /** Install a chrome stub that records the extension id of every message. */
  function stubChrome(response: unknown): string[] {
    const sent: string[] = [];
    const stub: ChromeStub = {
      runtime: {
        sendMessage: (extensionId, _message, callback) => {
          sent.push(extensionId);
          callback(response);
        },
      },
    };
    (globalThis as unknown as { chrome: ChromeStub }).chrome = stub;
    return sent;
  }

  it('isAvailable() is false when only the env id exists but chrome messaging is absent', () => {
    // The env id is server-injected configuration, not installation evidence: a page
    // carrying it on a browser without the extension must NOT look available.
    setWindow({ __ENV__: { VITE_STASH_WALLET_EXTENSION_ID: ENV_ID } });
    expect(ChromeExtensionTransport.isAvailable()).toBe(false);
  });

  it('isAvailable() is true when the env id resolves AND chrome messaging exists', () => {
    setWindow({ __ENV__: { VITE_STASH_WALLET_EXTENSION_ID: ENV_ID } });
    stubChrome({ success: true, data: null });
    expect(ChromeExtensionTransport.isAvailable()).toBe(true);
  });

  it('isAvailable() is false when every source is empty or whitespace', () => {
    setWindow({ __ENV__: { VITE_STASH_WALLET_EXTENSION_ID: '  ' } });
    stubChrome({ success: true, data: null });
    expect(ChromeExtensionTransport.isAvailable()).toBe(false);
  });

  it('isAvailable() is false without a window', () => {
    setWindow(undefined);
    stubChrome({ success: true, data: null });
    expect(ChromeExtensionTransport.isAvailable()).toBe(false);
  });

  it('constructs from the env id and messages that exact id', async () => {
    setWindow({ __ENV__: { VITE_STASH_WALLET_EXTENSION_ID: ` ${ENV_ID} ` } });
    const sent = stubChrome({ success: true, data: { ok: true } });

    const transport = new ChromeExtensionTransport();
    await expect(transport.send('GET_VERSION')).resolves.toEqual({ ok: true });
    expect(sent).toEqual([ENV_ID]);
  });

  it('constructs from the legacy node id when nothing newer exists', async () => {
    setWindow({ __STASH_NODE_EXTENSION_ID: NODE_ID });
    const sent = stubChrome({ success: true, data: 'v1' });

    const transport = new ChromeExtensionTransport();
    await expect(transport.send('GET_VERSION')).resolves.toBe('v1');
    expect(sent).toEqual([NODE_ID]);
  });

  it('prefers the marker when the env id is also present', async () => {
    setWindow({
      __stashwallet: { id: MARKER_ID },
      __ENV__: { VITE_STASH_WALLET_EXTENSION_ID: ENV_ID },
    });
    const sent = stubChrome({ success: true, data: 1 });

    await new ChromeExtensionTransport().send('GET_VERSION');
    expect(sent).toEqual([MARKER_ID]);
  });

  it('throws EXTENSION_NOT_FOUND when messaging exists but no source resolves an id', () => {
    setWindow({ __ENV__: { VITE_STASH_WALLET_EXTENSION_ID: '   ' } });
    stubChrome({ success: true, data: null });

    let error: unknown;
    try {
      new ChromeExtensionTransport();
    } catch (err) {
      error = err;
    }
    expect(error).toBeInstanceOf(TransportError);
    expect((error as TransportError).code).toBe('EXTENSION_NOT_FOUND');
  });

  it('throws EXTENSION_NOT_FOUND without a window', () => {
    setWindow(undefined);
    stubChrome({ success: true, data: null });

    let error: unknown;
    try {
      new ChromeExtensionTransport();
    } catch (err) {
      error = err;
    }
    expect(error).toBeInstanceOf(TransportError);
    expect((error as TransportError).code).toBe('EXTENSION_NOT_FOUND');
  });

  it('keeps an explicit constructor id authoritative over page globals', async () => {
    setWindow({ __ENV__: { VITE_STASH_WALLET_EXTENSION_ID: ENV_ID } });
    const sent = stubChrome({ success: true, data: true });

    await new ChromeExtensionTransport(OVERRIDE_ID).send('GET_VERSION');
    expect(sent).toEqual([OVERRIDE_ID]);
  });
});
