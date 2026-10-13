/**
 * Stable transport / provider error codes for third-party integrators.
 */

export type TransportErrorCode =
  | 'WALLET_LOCKED'
  | 'SESSION_EXPIRED'
  | 'NODE_NOT_CONFIGURED'
  | 'ORIGIN_NOT_ALLOWED'
  | 'ORIGIN_NOT_AUTHORIZED'
  | 'EXTENSION_NOT_FOUND'
  | 'PROVIDER_NOT_FOUND'
  | 'UNKNOWN_MESSAGE_TYPE'
  | 'USER_REJECTED'
  | 'NETWORK_SWITCH_TIMEOUT'
  | 'INVALID_PARAMETER'
  | 'APPROVAL_BUSY'
  | 'NOT_SUPPORTED'
  | 'TIMEOUT'
  | 'UNKNOWN';

const KNOWN_CODES = new Set<string>([
  'WALLET_LOCKED',
  'SESSION_EXPIRED',
  'NODE_NOT_CONFIGURED',
  'ORIGIN_NOT_ALLOWED',
  'ORIGIN_NOT_AUTHORIZED',
  'EXTENSION_NOT_FOUND',
  'PROVIDER_NOT_FOUND',
  'UNKNOWN_MESSAGE_TYPE',
  'USER_REJECTED',
  'NETWORK_SWITCH_TIMEOUT',
  'INVALID_PARAMETER',
  'APPROVAL_BUSY',
  'NOT_SUPPORTED',
  'TIMEOUT',
  'UNKNOWN',
]);

export function normalizeErrorCode(code: string | undefined): TransportErrorCode {
  if (code && KNOWN_CODES.has(code)) return code as TransportErrorCode;
  return 'UNKNOWN';
}

export class TransportError extends Error {
  readonly code: TransportErrorCode;

  constructor(code: TransportErrorCode | string, message?: string) {
    const normalized = normalizeErrorCode(typeof code === 'string' ? code : undefined);
    // Preserve unknown extension error strings when the code itself is not in the set.
    const resolved =
      typeof code === 'string' && !KNOWN_CODES.has(code) ? 'UNKNOWN' : normalized;
    super(message ?? (typeof code === 'string' ? code : resolved));
    this.name = 'TransportError';
    this.code = resolved;
  }
}

export function isKnownErrorCode(code: string): boolean {
  return KNOWN_CODES.has(code);
}
