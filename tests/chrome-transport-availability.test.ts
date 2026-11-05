import { afterEach, describe, expect, it } from 'vitest';
import { ChromeExtensionTransport } from '../src/transports/chrome-extension';
import { hasChromeRuntimeMessaging } from '../src/transports/chrome-runtime';
import { StashWalletClient } from '../src/client';
import { TransportError } from '../src/errors';

/**
 * Regression guard for the RGBDEX "chrome.runtime.sendMessage is not available in
 * this environment" report.
 *
 * The page had `window.__ENV__.VITE_STASH_WALLET_EXTENSION_ID` injected by its own
 * server, which meant `resolveExtensionId()` returned an id on a browser where no
 * extension was reachable. `isAvailable()` used to treat that id as proof of
 * installation, so `connect()` fell back to `ChromeExtensionTransport` and the raw
 * browser error leaked to the user.
 *
 * These tests state the contract explicitly: an id resolves the *address*, only a
 * live `chrome.runtime.sendMessage` proves the page can *reach* it.
 */

const ENV_ID = 'gdkgeejikjolbfmcfoidchgipeeeamam';

/** Minimal browser-like window: only what the resolver and provider wait touch. */
class FakeWindow extends EventTarget {
  __ENV__?: unknown;
  __stashwallet?: unknown;
  stashwallet?: unknown;
}

const chromeSlot = globalThis as unknown as { chrome?: unknown };
const windowSlot = globalThis as unknown as { window?: unknown };

function installPage(options?: { envId?: string; chrome?: unknown }): void {
  const fakeWindow = new FakeWindow();
  if (options?.envId !== undefined) {
    fakeWindow.__ENV__ = { VITE_STASH_WALLET_EXTENSION_ID: options.envId };
  }
  windowSlot.window = fakeWindow;
  if (options && 'chrome' in options && options.chrome !== undefined) {
    chromeSlot.chrome = options.chrome;
  }
}

afterEach(() => {
  delete chromeSlot.chrome;
  delete windowSlot.window;
});

describe('hasChromeRuntimeMessaging', () => {
  it('is false when chrome is undefined', () => {
    installPage({ envId: ENV_ID });
    expect(hasChromeRuntimeMessaging()).toBe(false);
  });

  it('is false when chrome is null', () => {
    installPage({ chrome: null });
    expect(hasChromeRuntimeMessaging()).toBe(false);
  });

  it('is false when chrome is a non-object', () => {
    for (const value of ['chrome', 42, true]) {
      installPage({ chrome: value });
      expect(hasChromeRuntimeMessaging()).toBe(false);
    }
  });

  it('is false when chrome.runtime is missing', () => {
    installPage({ chrome: {} });
    expect(hasChromeRuntimeMessaging()).toBe(false);
  });

  it('is false when chrome.runtime.sendMessage is not a function', () => {
    installPage({ chrome: { runtime: { sendMessage: 'nope' } } });
    expect(hasChromeRuntimeMessaging()).toBe(false);
  });

  it('is true when chrome.runtime.sendMessage is callable', () => {
    installPage({ chrome: { runtime: { sendMessage: () => undefined } } });
    expect(hasChromeRuntimeMessaging()).toBe(true);
  });
});

describe('ChromeExtensionTransport.isAvailable — id is not installation proof', () => {
  it('is false when only __ENV__ provides an id and chrome is missing (the regression)', () => {
    installPage({ envId: ENV_ID });
    expect(ChromeExtensionTransport.isAvailable()).toBe(false);
  });

  it('is false when chrome exists but chrome.runtime is missing', () => {
    installPage({ envId: ENV_ID, chrome: {} });
    expect(ChromeExtensionTransport.isAvailable()).toBe(false);
  });

  it('is false when chrome.runtime.sendMessage is not a function', () => {
    installPage({ envId: ENV_ID, chrome: { runtime: { sendMessage: {} } } });
    expect(ChromeExtensionTransport.isAvailable()).toBe(false);
  });

  it('is true only when the env id resolves AND messaging is available', () => {
    installPage({ envId: ENV_ID, chrome: { runtime: { sendMessage: () => undefined } } });
    expect(ChromeExtensionTransport.isAvailable()).toBe(true);
  });

  it('is false when messaging is available but no id resolves', () => {
    installPage({ chrome: { runtime: { sendMessage: () => undefined } } });
    expect(ChromeExtensionTransport.isAvailable()).toBe(false);
  });
});

describe('ChromeExtensionTransport constructor — fail before send', () => {
  it('throws an actionable EXTENSION_NOT_FOUND when an id exists but messaging does not', () => {
    installPage({ envId: ENV_ID });

    let error: unknown;
    try {
      new ChromeExtensionTransport();
    } catch (err) {
      error = err;
    }

    expect(error).toBeInstanceOf(TransportError);
    const transportError = error as TransportError;
    expect(transportError.code).toBe('EXTENSION_NOT_FOUND');
    // The message must name both real causes so the reader can act on it.
    expect(transportError.message).toMatch(/install/i);
    expect(transportError.message).toMatch(/externally_connectable|origin/i);
    // The old pure-environment string must be gone.
    expect(transportError.message).not.toMatch(/is not available in this environment/);
  });

  it('applies the same guard to an explicitly supplied extension id', () => {
    installPage({ chrome: undefined });

    expect(() => new ChromeExtensionTransport(ENV_ID)).toThrowError(TransportError);
    try {
      new ChromeExtensionTransport(ENV_ID);
    } catch (err) {
      expect((err as TransportError).code).toBe('EXTENSION_NOT_FOUND');
    }
  });

  it('does not throw when both id and messaging exist', () => {
    installPage({ envId: ENV_ID, chrome: { runtime: { sendMessage: () => undefined } } });
    expect(() => new ChromeExtensionTransport()).not.toThrow();
  });
});

describe('ChromeExtensionTransport.send — guard is re-evaluated', () => {
  it('reports EXTENSION_NOT_FOUND when chrome disappears after construction', async () => {
    installPage({ envId: ENV_ID, chrome: { runtime: { sendMessage: () => undefined } } });
    const transport = new ChromeExtensionTransport();

    // Simulates an extension reload/uninstall or a page rewriting the global.
    delete chromeSlot.chrome;

    await expect(transport.send('GET_VERSION')).rejects.toMatchObject({
      code: 'EXTENSION_NOT_FOUND',
    });
  });
});

describe('StashWalletClient.connect — generic provider failure, not a transport error', () => {
  it('throws PROVIDER_NOT_FOUND when the env id exists but no provider is reachable', async () => {
    installPage({ envId: ENV_ID });

    // `connect()` waits for the injected provider first, then falls back to the
    // extension transport only when that transport reports itself available.
    // Neither is true here, so the documented PROVIDER_NOT_FOUND surfaces.
    const error = await StashWalletClient.connect({ timeoutMs: 0 }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(TransportError);
    expect((error as TransportError).code).toBe('PROVIDER_NOT_FOUND');
  });

  it('isInstalled() is false for the same page state', () => {
    installPage({ envId: ENV_ID });
    const transport = {
      send: async <TPayload = unknown, TResult = unknown>(
        _type: string,
        _payload?: TPayload,
      ): Promise<TResult> => undefined as TResult,
    };
    expect(new StashWalletClient(transport).isInstalled()).toBe(false);
  });
});
