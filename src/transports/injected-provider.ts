/**
 * Transport that talks to window.stashwallet (injected by the extension).
 * Works on any site where the content script injects the provider — no
 * externally_connectable allowlist required.
 */

import type { Transport, TransportOptions } from './base';
import { TransportError } from '../errors';
import type { StashWalletProvider } from '../provider';

interface ProviderWindow {
  stashwallet?: StashWalletProvider;
}

export class InjectedProviderTransport implements Transport {
  private readonly _timeoutMs: number;
  private static readonly DEFAULT_TIMEOUT_MS = 120_000;

  constructor(options?: TransportOptions) {
    this._timeoutMs = options?.timeoutMs ?? InjectedProviderTransport.DEFAULT_TIMEOUT_MS;
  }

  static isAvailable(): boolean {
    if (typeof window === 'undefined') return false;
    const win = window as ProviderWindow;
    return typeof win.stashwallet?.request === 'function';
  }

  /** Wait until window.stashwallet appears (late injection). */
  static async waitForProvider(timeoutMs = 5000): Promise<StashWalletProvider> {
    if (typeof window === 'undefined') {
      throw new TransportError('PROVIDER_NOT_FOUND', 'Not in a browser environment');
    }
    const existing = (window as ProviderWindow).stashwallet;
    if (existing?.request) return existing;

    return new Promise((resolve, reject) => {
      const start = Date.now();
      const onReady = () => {
        cleanup();
        const p = (window as ProviderWindow).stashwallet;
        if (p?.request) resolve(p);
        else reject(new TransportError('PROVIDER_NOT_FOUND', 'Provider event fired but stashwallet missing'));
      };
      const timer = setInterval(() => {
        const p = (window as ProviderWindow).stashwallet;
        if (p?.request) {
          cleanup();
          resolve(p);
        } else if (Date.now() - start > timeoutMs) {
          cleanup();
          reject(new TransportError('PROVIDER_NOT_FOUND', 'Stash Wallet provider injection timeout'));
        }
      }, 100);
      const cleanup = () => {
        clearInterval(timer);
        window.removeEventListener('stashwallet#initialized', onReady);
      };
      window.addEventListener('stashwallet#initialized', onReady);
    });
  }

  private _provider(): StashWalletProvider {
    const p = (typeof window !== 'undefined' ? (window as ProviderWindow).stashwallet : undefined);
    if (!p?.request) {
      throw new TransportError(
        'PROVIDER_NOT_FOUND',
        'Stash Wallet provider not injected. Install the extension and reload the page.',
      );
    }
    return p;
  }

  async send<TPayload = unknown, TResult = unknown>(
    type: string,
    payload?: TPayload,
  ): Promise<TResult> {
    const provider = this._provider();
    const result = await Promise.race([
      provider.request({ method: type, params: payload }),
      new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new TransportError('TIMEOUT', `Request ${type} timed out after ${this._timeoutMs}ms`));
        }, this._timeoutMs);
      }),
    ]);
    return result as TResult;
  }
}
