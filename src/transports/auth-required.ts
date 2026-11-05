/**
 * Page-level re-authorization signal shared by every transport.
 *
 * When the extension answers `ORIGIN_NOT_AUTHORIZED`, the page must be able to
 * reopen its wallet/login flow. The extension cannot dispatch DOM events into the
 * page, so the transport that received the error owns that responsibility.
 *
 * Behaviour intentionally matches the legacy RGBDEX adapter so pages can switch
 * transports without changing their listener:
 *   window.dispatchEvent(new CustomEvent('walletAuthRequired', {
 *     detail: { reason: 'ORIGIN_NOT_AUTHORIZED' },
 *   }))
 */

/** Event name pages listen for. */
export const WALLET_AUTH_REQUIRED_EVENT = 'walletAuthRequired' as const;

/** The only reason currently emitted. */
export const REASON_ORIGIN_NOT_AUTHORIZED = 'ORIGIN_NOT_AUTHORIZED' as const;

/**
 * Dispatch `walletAuthRequired` when `code` is `ORIGIN_NOT_AUTHORIZED`.
 *
 * Never throws: this runs inside error paths, and a missing `window`/`CustomEvent`
 * (SSR, workers, unit tests without a DOM) must not replace the real transport
 * error with a secondary one.
 *
 * @returns true when an event was dispatched.
 */
export function notifyAuthRequired(code: string | undefined): boolean {
  if (code !== REASON_ORIGIN_NOT_AUTHORIZED) return false;
  if (typeof window === 'undefined') return false;
  try {
    window.dispatchEvent(
      new CustomEvent(WALLET_AUTH_REQUIRED_EVENT, {
        detail: { reason: REASON_ORIGIN_NOT_AUTHORIZED },
      }),
    );
  } catch {
    /* ignore: a re-auth prompt is best-effort, the transport error is authoritative */
  }
  return true;
}
