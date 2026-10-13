/**
 * Browser / UMD entry. Safe to load via <script>; mounts globals only once.
 */

import { StashWalletClient } from './client';
import { ChromeExtensionTransport } from './transports/chrome-extension';
import { InjectedProviderTransport } from './transports/injected-provider';
import { TransportError } from './errors';
import { detectProvider, getInjectedProvider } from './provider';
import {
  buildAuthV2Message,
  buildCanonicalMessage,
  validateAuthV2Context,
  assertAuthSignatureRequest,
  PROTOCOL_VERSION,
} from './protocol';

export {
  StashWalletClient,
  ChromeExtensionTransport,
  InjectedProviderTransport,
  TransportError,
  detectProvider,
  getInjectedProvider,
  buildAuthV2Message,
  buildCanonicalMessage,
  validateAuthV2Context,
  assertAuthSignatureRequest,
  PROTOCOL_VERSION,
};

export * from './types';

interface BrowserGlobal {
  StashWalletSDK?: typeof api;
  StashWalletClient?: typeof StashWalletClient;
}

const api = {
  StashWalletClient,
  ChromeExtensionTransport,
  InjectedProviderTransport,
  TransportError,
  detectProvider,
  getInjectedProvider,
  buildAuthV2Message,
  buildCanonicalMessage,
  validateAuthV2Context,
  assertAuthSignatureRequest,
  PROTOCOL_VERSION,
};

if (typeof window !== 'undefined') {
  const g = window as unknown as BrowserGlobal;
  if (!g.StashWalletSDK) {
    g.StashWalletSDK = api;
  }
  if (!g.StashWalletClient) {
    g.StashWalletClient = StashWalletClient;
  }
}

export default api;
