/**
 * Chrome Extension Transport via chrome.runtime.sendMessage(extensionId, …).
 * Requires externally_connectable for the page origin.
 */

import type { Transport, TransportOptions } from './base';
import { TransportError, extractErrorCode, isKnownErrorCode } from '../errors';
import { notifyAuthRequired } from './auth-required';
import { resolveExtensionId } from './extension-id';
import {
  hasChromeRuntimeMessaging,
  readChromeRuntimeMessaging,
  type ChromeRuntimeMessaging,
} from './chrome-runtime';

/**
 * Id resolved, but this page still cannot talk to the extension.
 *
 * Two causes share this message on purpose: the page cannot tell "not installed"
 * apart from "installed but this origin is not allowlisted", and both need the same
 * first action from the user/developer.
 */
const UNREACHABLE_MESSAGE =
  "Stash Wallet extension is not reachable from this page. Install and enable the extension, then reload; if it is already installed, this site's origin is not allowed by the extension (externally_connectable).";

/** No id marker and no usable page configuration. */
const NOT_DETECTED_MESSAGE =
  'Stash Wallet extension not detected. Make sure it is installed and enabled.';

export class ChromeExtensionTransport implements Transport {
  private readonly _extensionId: string;
  private readonly _timeoutMs: number;

  private static readonly MAX_RETRIES = 3;
  private static readonly RETRY_DELAY_MS = 300;
  private static readonly DEFAULT_TIMEOUT_MS = 120_000;

  /**
   * @throws TransportError `EXTENSION_NOT_FOUND` when this page has no extension
   *   messaging capability, or when no extension id can be resolved. Failing here
   *   (instead of in `send()`) keeps the misleading raw `chrome` error away from
   *   callers that built the transport optimistically.
   */
  constructor(extensionId?: string, options?: TransportOptions) {
    this._timeoutMs = options?.timeoutMs ?? ChromeExtensionTransport.DEFAULT_TIMEOUT_MS;

    // Two independent facts, checked in the order the reader can act on them:
    //   1. which extension to address (an explicit id wins over page markers);
    //   2. whether this page may talk to any extension at all.
    const id = extensionId ? extensionId : resolveExtensionId();
    if (!id) {
      throw new TransportError('EXTENSION_NOT_FOUND', NOT_DETECTED_MESSAGE);
    }

    // A resolved id only says *which* extension to talk to — it is not evidence that
    // this page may talk to one. Server-injected `__ENV__` config ships an id to
    // every visitor, so this second check is what actually separates "installed and
    // allowlisted" from "nothing here".
    if (!hasChromeRuntimeMessaging()) {
      throw new TransportError('EXTENSION_NOT_FOUND', UNREACHABLE_MESSAGE);
    }

    this._extensionId = id;
  }

  /**
   * Whether the extension can be addressed *and* reached from this page.
   *
   * `resolveExtensionId()` alone is not enough: its `__ENV__` source is
   * server-injected configuration that exists on every page load, including on
   * visitors who never installed the extension.
   */
  static isAvailable(): boolean {
    return resolveExtensionId() !== undefined && hasChromeRuntimeMessaging();
  }

  async send<TPayload = unknown, TResult = unknown>(
    type: string,
    payload?: TPayload,
  ): Promise<TResult> {
    let lastError: TransportError | undefined;

    for (let attempt = 0; attempt <= ChromeExtensionTransport.MAX_RETRIES; attempt++) {
      if (attempt > 0) {
        await new Promise((r) => setTimeout(r, ChromeExtensionTransport.RETRY_DELAY_MS));
      }

      // Re-read the capability per attempt: the page (or an extension reload) may
      // have replaced `chrome` since construction.
      const runtime = readChromeRuntimeMessaging();
      if (!runtime) {
        throw new TransportError('EXTENSION_NOT_FOUND', UNREACHABLE_MESSAGE);
      }

      try {
        return await this._sendOnce<TPayload, TResult>(runtime, type, payload);
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

  private _sendOnce<TPayload, TResult>(
    runtime: ChromeRuntimeMessaging,
    type: string,
    payload?: TPayload,
  ): Promise<TResult> {
    return new Promise<TResult>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new TransportError('TIMEOUT', `Request ${type} timed out after ${this._timeoutMs}ms`));
      }, this._timeoutMs);

      runtime.sendMessage(this._extensionId, { type, payload }, (response) => {
        clearTimeout(timer);
        if (runtime.lastError) {
          reject(new TransportError('EXTENSION_NOT_FOUND', runtime.lastError.message));
          return;
        }

        if (!response) {
          reject(new TransportError('UNKNOWN', 'No response from extension'));
          return;
        }

        if (!response.success) {
          const code = extractErrorCode(response.error);
          const resolved = code && isKnownErrorCode(code) ? code : 'UNKNOWN';
          notifyAuthRequired(resolved);
          reject(new TransportError(resolved, response.error));
          return;
        }

        resolve(response.data as TResult);
      });
    });
  }
}
