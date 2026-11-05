/**
 * Capability probe for `chrome.runtime` messaging on an ordinary web page.
 *
 * This is deliberately separate from `extension-id.ts`. Knowing *which* extension to
 * address (`resolveExtensionId()`) and being able to address it are two different
 * facts: server-injected config hands every visitor an id whether or not the
 * extension is installed, while Chrome only exposes `chrome.runtime.sendMessage` to a
 * page when the extension is installed AND the page origin is listed in that
 * extension's `externally_connectable` allowlist.
 */

/** Shape of a reply from the extension, before any field is trusted. */
export interface ExtensionResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

/** The parts of `chrome.runtime` this package calls. */
export interface ChromeRuntimeMessaging {
  sendMessage: (
    extensionId: string,
    message: unknown,
    callback: (response: ExtensionResponse<unknown> | undefined) => void,
  ) => void;
  lastError?: { message?: string };
}

/** Shape of the page-mutable `chrome` global before it is validated. */
interface ChromeGlobal {
  runtime?: unknown;
}

/**
 * Read `chrome.runtime` without trusting either object.
 *
 * `chrome` is a page-writable global, so it may be absent, replaced by a non-object,
 * or deleted between calls. `typeof` plus null checks keep that from turning into a
 * ReferenceError / TypeError before the question is answered.
 */
export function readChromeRuntimeMessaging(): ChromeRuntimeMessaging | undefined {
  const chromeGlobal = (globalThis as unknown as { chrome?: unknown }).chrome;
  if (typeof chromeGlobal !== 'object' || chromeGlobal === null) return undefined;

  const runtime = (chromeGlobal as ChromeGlobal).runtime;
  if (typeof runtime !== 'object' || runtime === null) return undefined;

  const messaging = runtime as ChromeRuntimeMessaging;
  return typeof messaging.sendMessage === 'function' ? messaging : undefined;
}

/**
 * Whether this page can currently send a message to a browser extension.
 *
 * A resolved extension id is NOT evidence of this: the id may come from
 * server-injected configuration present on every page load. This probe is the only
 * authoritative "the extension is reachable from here" signal a page has, so every
 * caller that is about to call `chrome.runtime.sendMessage` must gate on it and
 * report `EXTENSION_NOT_FOUND` instead of letting a raw browser error escape.
 */
export function hasChromeRuntimeMessaging(): boolean {
  return readChromeRuntimeMessaging() !== undefined;
}
