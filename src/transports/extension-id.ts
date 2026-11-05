/**
 * Single source of truth for discovering the Stash Wallet extension id from the page.
 *
 * Every global read here is treated as untrusted input: the page (or an injected
 * script) may define any of these markers with an arbitrary value, so each one is
 * validated as a non-empty, trimmed string before it is used.
 */

/**
 * Shape of the window fields this module inspects.
 *
 * `__ENV__` is written by a server-injected `<script>` (see RGBDEX `config/env.js`
 * and `config/env-loader.js`), so its members are `unknown` on purpose: the value
 * only becomes an id after the string guard below accepts it.
 */
export interface ExtensionIdWindow {
  /** Marker written by the extension's content script; authoritative when present. */
  __stashwallet?: { id?: unknown } | null;
  /** Manual page override. */
  __STASH_WALLET_EXTENSION_ID?: unknown;
  /** Legacy name of the manual override, kept for backwards compatibility. */
  __STASH_NODE_EXTENSION_ID?: unknown;
  /** Server-injected public env whitelist; shape is not trusted until read. */
  __ENV__?: unknown;
}

/**
 * Normalize one candidate into a usable id.
 *
 * Absent, non-string, empty and whitespace-only values all collapse to `undefined`
 * so that `??` chaining can fall through to the next candidate. Trimming also stops
 * a value such as `' abc '` from being handed to `chrome.runtime.sendMessage`.
 */
export function normalizeExtensionId(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

/**
 * Read the id out of the server-injected `window.__ENV__` object.
 *
 * `__ENV__` is produced by a `<script>` the page does not own, so it is not assumed
 * to be an object at all: anything that is not a non-null object is treated as absent.
 */
function readEnvExtensionId(env: unknown): string | undefined {
  if (typeof env !== 'object' || env === null) return undefined;
  const record = env as { VITE_STASH_WALLET_EXTENSION_ID?: unknown };
  return normalizeExtensionId(record.VITE_STASH_WALLET_EXTENSION_ID);
}

/**
 * Resolve the extension id from the page globals.
 *
 * Resolution order (first usable value wins), matching the hand-written adapter in
 * `dex/rgbdex/static/js/stash-wallet-sdk.js`:
 *
 *   1. `window.__stashwallet.id`                        content-script marker (authoritative)
 *   2. `window.__STASH_WALLET_EXTENSION_ID`             manual page override
 *   3. `window.__ENV__.VITE_STASH_WALLET_EXTENSION_ID`  server-injected env whitelist
 *   4. `window.__STASH_NODE_EXTENSION_ID`               legacy fallback
 *
 * Step 4 is deliberately last and deliberately kept: `__STASH_NODE_EXTENSION_ID`
 * predates the `node-manager` -> `stash-cloud` rename and older published pages may
 * still set it. The SDK reads it so already shipped integrations keep resolving an
 * id; ranking it below the modern markers prevents it from shadowing them.
 *
 * There is intentionally no built-in fallback id: an unknown id makes Chrome answer
 * with "Could not establish connection", which hides the real cause.
 */
export function resolveExtensionId(): string | undefined {
  if (typeof window === 'undefined') return undefined;

  const win = window as unknown as ExtensionIdWindow;

  return (
    normalizeExtensionId(win.__stashwallet?.id) ??
    normalizeExtensionId(win.__STASH_WALLET_EXTENSION_ID) ??
    readEnvExtensionId(win.__ENV__) ??
    normalizeExtensionId(win.__STASH_NODE_EXTENSION_ID)
  );
}
