import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { ChromeExtensionTransport } from '../src/transports/chrome-extension';
import { InjectedProviderTransport } from '../src/transports/injected-provider';
import { TransportError } from '../src/errors';

/**
 * Phase B contract: an `ORIGIN_NOT_AUTHORIZED` rejection must reach the page as a
 * `walletAuthRequired` DOM event on BOTH transports, and nothing else may fire it.
 *
 * The package's vitest environment is `node`, so the suite installs a minimal
 * EventTarget-backed `window` (Node provides `Event` / `CustomEvent`) and removes it
 * afterwards. That also proves the transports tolerate a browser-like global without
 * depending on jsdom.
 */

const EXTENSION_ID = 'abcdefghijklmnopabcdefghijklmnop';

type FakeWindow = EventTarget & {
  chrome?: unknown;
  stashwallet?: unknown;
  __stashwallet?: unknown;
};

let fakeWindow: FakeWindow;

beforeAll(() => {
  fakeWindow = new EventTarget() as FakeWindow;
  (globalThis as unknown as { window: FakeWindow }).window = fakeWindow;
});

afterAll(() => {
  delete (globalThis as unknown as { window?: unknown }).window;
});

interface ChromeStub {
  runtime: {
    sendMessage: (
      extensionId: string,
      message: unknown,
      callback: (response: unknown) => void,
    ) => void;
    lastError?: { message?: string };
  };
}

function stubChrome(response: unknown): ChromeStub {
  return {
    runtime: {
      sendMessage: (_id, _message, callback) => {
        callback(response);
      },
      lastError: undefined,
    },
  };
}

describe('walletAuthRequired dispatch', () => {
  const listeners: Array<() => void> = [];

  /** Record every walletAuthRequired event the transports dispatch. */
  function listen(): Array<{ reason?: string }> {
    const seen: Array<{ reason?: string }> = [];
    const handler = (event: Event) => {
      seen.push(((event as CustomEvent<{ reason?: string }>).detail ?? {}) as { reason?: string });
    };
    fakeWindow.addEventListener('walletAuthRequired', handler);
    listeners.push(() => fakeWindow.removeEventListener('walletAuthRequired', handler));
    return seen;
  }

  afterEach(() => {
    for (const off of listeners.splice(0)) off();
    delete (globalThis as unknown as { chrome?: unknown }).chrome;
    delete fakeWindow.stashwallet;
  });

  describe('ChromeExtensionTransport', () => {
    it('dispatches walletAuthRequired once for ORIGIN_NOT_AUTHORIZED', async () => {
      (globalThis as unknown as { chrome: ChromeStub }).chrome = stubChrome({ success: false, error: 'ORIGIN_NOT_AUTHORIZED' });
      const seen = listen();
      const transport = new ChromeExtensionTransport(EXTENSION_ID);

      await expect(transport.send('GET_NODE_BALANCES')).rejects.toBeInstanceOf(TransportError);
      expect(seen).toEqual([{ reason: 'ORIGIN_NOT_AUTHORIZED' }]);
    });

    it('does not dispatch for other error codes', async () => {
      (globalThis as unknown as { chrome: ChromeStub }).chrome = stubChrome({ success: false, error: 'USER_REJECTED' });
      const seen = listen();
      const transport = new ChromeExtensionTransport(EXTENSION_ID);

      await expect(transport.send('CLOSE_CHANNEL', {})).rejects.toMatchObject({
        code: 'USER_REJECTED',
      });
      expect(seen).toEqual([]);
    });
  });

  describe('InjectedProviderTransport', () => {
    it('dispatches walletAuthRequired once for ORIGIN_NOT_AUTHORIZED', async () => {
      fakeWindow.stashwallet = {
        isStashWallet: true,
        protocolVersion: '1.0.0',
        request: vi.fn().mockRejectedValue(new Error('ORIGIN_NOT_AUTHORIZED')),
      };
      const seen = listen();
      const transport = new InjectedProviderTransport();

      const error = await transport.send('CREATE_RGB_LN_INVOICE', {}).catch((e: unknown) => e);
      expect(error).toBeInstanceOf(TransportError);
      expect((error as TransportError).code).toBe('ORIGIN_NOT_AUTHORIZED');
      expect(seen).toEqual([{ reason: 'ORIGIN_NOT_AUTHORIZED' }]);
    });

    it('does not dispatch for other error codes', async () => {
      fakeWindow.stashwallet = {
        isStashWallet: true,
        protocolVersion: '1.0.0',
        request: vi.fn().mockRejectedValue(new Error('INVALID_PARAMETER: contract_id required')),
      };
      const seen = listen();
      const transport = new InjectedProviderTransport();

      const error = await transport.send('CREATE_RGB_LN_INVOICE', {}).catch((e: unknown) => e);
      // The bridge appends a detail suffix; the leading token is still the error code.
      expect((error as TransportError).code).toBe('INVALID_PARAMETER');
      expect(seen).toEqual([]);
    });

    it('keeps TIMEOUT distinct from auth failures', async () => {
      fakeWindow.stashwallet = {
        isStashWallet: true,
        protocolVersion: '1.0.0',
        request: vi.fn().mockRejectedValue(new Error('TIMEOUT')),
      };
      const seen = listen();
      const transport = new InjectedProviderTransport({ timeoutMs: 50 });

      const error = await transport.send('GET_ACCOUNTS').catch((e: unknown) => e);
      expect((error as TransportError).code).toBe('TIMEOUT');
      expect(seen).toEqual([]);
    });
  });
});
