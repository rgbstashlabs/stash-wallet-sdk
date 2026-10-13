/**
 * Injected provider contract (window.stashwallet).
 * The extension injects this object; the SDK discovers and wraps it.
 */

import type {
  ProviderCapabilities,
  ProviderEventHandler,
  ProviderEventName,
} from './types';

export interface ProviderRequest {
  method: string;
  params?: unknown;
}

export interface StashWalletProvider {
  readonly isStashWallet: true;
  readonly protocolVersion: string;
  request(args: ProviderRequest): Promise<unknown>;
  isConnected(): Promise<boolean>;
  getCapabilities(): Promise<ProviderCapabilities>;
  on(event: ProviderEventName, handler: ProviderEventHandler): void;
  removeListener(event: ProviderEventName, handler: ProviderEventHandler): void;
}

declare global {
  interface Window {
    stashwallet?: StashWalletProvider;
    __stashwallet?: { id: string };
  }
}

export function getInjectedProvider(): StashWalletProvider | undefined {
  if (typeof window === 'undefined') return undefined;
  return window.stashwallet;
}

export async function detectProvider(timeoutMs = 5000): Promise<StashWalletProvider | null> {
  const existing = getInjectedProvider();
  if (existing?.request) return existing;
  if (typeof window === 'undefined') return null;

  return new Promise((resolve) => {
    const start = Date.now();
    const onReady = () => {
      cleanup();
      resolve(getInjectedProvider() ?? null);
    };
    const timer = setInterval(() => {
      const p = getInjectedProvider();
      if (p?.request) {
        cleanup();
        resolve(p);
      } else if (Date.now() - start > timeoutMs) {
        cleanup();
        resolve(null);
      }
    }, 100);
    const cleanup = () => {
      clearInterval(timer);
      window.removeEventListener('stashwallet#initialized', onReady);
    };
    window.addEventListener('stashwallet#initialized', onReady);
  });
}
