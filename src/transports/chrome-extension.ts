/**
 * Chrome Extension Transport via chrome.runtime.sendMessage(extensionId, …).
 * Requires externally_connectable for the page origin.
 */

import type { Transport, TransportOptions } from './base';
import { TransportError, isKnownErrorCode } from '../errors';

interface StashWalletWindow {
  __stashwallet?: { id: string };
  __STASH_WALLET_EXTENSION_ID?: string;
  __STASH_NODE_EXTENSION_ID?: string;
}

interface ExtensionResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

declare const chrome: {
  runtime?: {
    sendMessage: (
      extensionId: string,
      message: unknown,
      callback: (response: ExtensionResponse<unknown> | undefined) => void,
    ) => void;
    lastError?: { message?: string };
  };
};

export class ChromeExtensionTransport implements Transport {
  private readonly _extensionId: string;
  private readonly _timeoutMs: number;

  private static readonly MAX_RETRIES = 3;
  private static readonly RETRY_DELAY_MS = 300;
  private static readonly DEFAULT_TIMEOUT_MS = 120_000;

  constructor(extensionId?: string, options?: TransportOptions) {
    this._timeoutMs = options?.timeoutMs ?? ChromeExtensionTransport.DEFAULT_TIMEOUT_MS;
    if (extensionId) {
      this._extensionId = extensionId;
    } else {
      const id = ChromeExtensionTransport._resolveId();
      if (!id) {
        throw new TransportError(
          'EXTENSION_NOT_FOUND',
          'Stash Wallet extension not detected. Make sure it is installed and enabled.',
        );
      }
      this._extensionId = id;
    }
  }

  private static _resolveId(): string | undefined {
    const win = (typeof window !== 'undefined' ? window : {}) as StashWalletWindow;
    return (
      win.__stashwallet?.id ||
      win.__STASH_WALLET_EXTENSION_ID ||
      win.__STASH_NODE_EXTENSION_ID ||
      undefined
    );
  }

  static isAvailable(): boolean {
    return typeof ChromeExtensionTransport._resolveId() === 'string';
  }

  async send<TPayload = unknown, TResult = unknown>(
    type: string,
    payload?: TPayload,
  ): Promise<TResult> {
    if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) {
      throw new TransportError(
        'EXTENSION_NOT_FOUND',
        'chrome.runtime.sendMessage is not available in this environment.',
      );
    }

    let lastError: TransportError | undefined;

    for (let attempt = 0; attempt <= ChromeExtensionTransport.MAX_RETRIES; attempt++) {
      if (attempt > 0) {
        await new Promise((r) => setTimeout(r, ChromeExtensionTransport.RETRY_DELAY_MS));
      }

      try {
        return await this._sendOnce<TPayload, TResult>(type, payload);
      } catch (err) {
        if (
          err instanceof TransportError &&
          err.code === 'EXTENSION_NOT_FOUND' &&
          err.message.includes('Could not establish connection')
        ) {
          lastError = err;
          continue;
        }
        throw err;
      }
    }

    throw lastError!;
  }

  private _sendOnce<TPayload, TResult>(type: string, payload?: TPayload): Promise<TResult> {
    return new Promise<TResult>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new TransportError('TIMEOUT', `Request ${type} timed out after ${this._timeoutMs}ms`));
      }, this._timeoutMs);

      chrome.runtime!.sendMessage(
        this._extensionId,
        { type, payload },
        (response) => {
          clearTimeout(timer);
          if (chrome.runtime?.lastError) {
            reject(
              new TransportError(
                'EXTENSION_NOT_FOUND',
                chrome.runtime.lastError.message,
              ),
            );
            return;
          }

          if (!response) {
            reject(new TransportError('UNKNOWN', 'No response from extension'));
            return;
          }

          if (!response.success) {
            const code = response.error;
            reject(
              new TransportError(
                code && isKnownErrorCode(code) ? code : 'UNKNOWN',
                response.error,
              ),
            );
            return;
          }

          resolve(response.data as TResult);
        },
      );
    });
  }
}
