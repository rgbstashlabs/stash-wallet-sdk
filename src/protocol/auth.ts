/**
 * Auth protocol helpers shared by the wallet extension and third-party backends.
 * No browser side effects — safe to import from Node / SSR.
 */

import type { Network } from '../types';

export const AUTH_PROTOCOL_VERSION = 'V1' as const;
export const AUTH_MESSAGE_PREFIX = `RGBS-AUTH-${AUTH_PROTOCOL_VERSION}` as const;

/** Legacy KDF constants (passphrase path). Current wallet uses mnemonic HKDF; kept for docs/compat. */
export const AUTH_KDF_SALT = 'RGBS-AUTH-IDENTITY-V1' as const;
export const AUTH_KDF_ITERATIONS = 600_000 as const;
export const AUTH_KDF_KEY_LENGTH_BYTES = 32 as const;

/**
 * V1 canonical message.
 * Format: RGBS-AUTH-V1|{challenge_id}|{nonce}|{origin}|{network}
 */
export function buildCanonicalMessage(
  challengeId: string,
  nonce: string,
  origin: string,
  network: Network,
): string {
  return `${AUTH_MESSAGE_PREFIX}|${challengeId}|${nonce}|${origin}|${network}`;
}

/** V2 metadata is public context, not proof of client authenticity. */
export interface AuthV2Context {
  challenge_id: string;
  nonce: string;
  origin: string;
  network: string;
  wallet_type: string;
  client_id: string;
  purpose: 'login';
  signature_version: 2;
  timestamp: number;
  expires_at: number;
}

export function buildAuthV2Message(c: AuthV2Context): string {
  if (
    c.signature_version !== 2 ||
    c.purpose !== 'login' ||
    [c.challenge_id, c.nonce, c.origin, c.network, c.wallet_type, c.client_id].some(
      (v) => typeof v !== 'string' || !v || v.includes('|'),
    ) ||
    !Number.isSafeInteger(c.timestamp) ||
    !Number.isSafeInteger(c.expires_at) ||
    c.timestamp <= 0 ||
    c.expires_at <= c.timestamp
  ) {
    throw new Error('INVALID_PARAMETER');
  }
  return `RGBS-AUTH-V2|${c.challenge_id}|${c.nonce}|${c.origin}|${c.network}|${c.wallet_type}|${c.client_id}|${c.purpose}|${c.timestamp}|${c.expires_at}`;
}

export function validateAuthV2Context(
  c: AuthV2Context,
  origin: string,
  now = Math.floor(Date.now() / 1000),
): void {
  buildAuthV2Message(c);
  let originOk = false;
  try {
    originOk = new URL(origin).origin === origin;
  } catch {
    originOk = false;
  }
  if (
    !/^[a-f0-9]{32}$/.test(c.challenge_id) ||
    !/^[a-f0-9]{64}$/.test(c.nonce) ||
    c.origin !== origin ||
    (!originOk && !/^chrome-extension:\/\/[a-p]{32}$/.test(origin)) ||
    c.timestamp > now ||
    now - c.timestamp >= 120 ||
    c.expires_at <= now ||
    c.expires_at - c.timestamp > 120 ||
    !/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(c.client_id)
  ) {
    throw new Error('INVALID_PARAMETER');
  }
}

/** Runtime check for auth request shapes before sending to the wallet. */
export function assertAuthSignatureRequest(params: unknown): void {
  if (!params || typeof params !== 'object') throw new Error('INVALID_PARAMETER');
  const p = params as Record<string, unknown>;
  if (typeof p.challenge_id !== 'string' || !/^[a-f0-9]{32}$/.test(p.challenge_id)) {
    throw new Error('INVALID_PARAMETER');
  }
  if (typeof p.nonce !== 'string' || !/^[a-f0-9]{64}$/.test(p.nonce)) {
    throw new Error('INVALID_PARAMETER');
  }
  if (typeof p.network !== 'string' || !p.network) throw new Error('INVALID_PARAMETER');
  if (p.signature_version !== 1 && p.signature_version !== 2) {
    throw new Error('INVALID_PARAMETER');
  }
  if (p.signature_version === 2) {
    if (p.wallet_type !== 'stashwallet' || p.purpose !== 'login') {
      throw new Error('INVALID_PARAMETER');
    }
    if (typeof p.client_id !== 'string' || !p.client_id) throw new Error('INVALID_PARAMETER');
    if (!Number.isSafeInteger(p.timestamp) || !Number.isSafeInteger(p.expires_at)) {
      throw new Error('INVALID_PARAMETER');
    }
  }
}
