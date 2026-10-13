import { describe, expect, it } from 'vitest';
import {
  assertAuthSignatureRequest,
  buildAuthV2Message,
  buildCanonicalMessage,
  validateAuthV2Context,
} from '../src/protocol/auth';

describe('auth protocol', () => {
  it('builds V1 canonical message', () => {
    expect(buildCanonicalMessage('a'.repeat(32), 'b'.repeat(64), 'https://example.com', 'regtest')).toBe(
      `RGBS-AUTH-V1|${'a'.repeat(32)}|${'b'.repeat(64)}|https://example.com|regtest`,
    );
  });

  it('builds and validates V2 context', () => {
    const now = Math.floor(Date.now() / 1000);
    const ctx = {
      signature_version: 2 as const,
      challenge_id: 'ab'.repeat(16),
      nonce: 'cd'.repeat(32),
      origin: 'https://regtest.rgbdex.net',
      network: 'regtest',
      wallet_type: 'stashwallet',
      client_id: 'rgbdex',
      purpose: 'login' as const,
      timestamp: now,
      expires_at: now + 120,
    };
    expect(buildAuthV2Message(ctx)).toMatch(/^RGBS-AUTH-V2\|/);
    expect(() => validateAuthV2Context(ctx, ctx.origin, now)).not.toThrow();
    expect(() => validateAuthV2Context({ ...ctx, expires_at: now }, ctx.origin, now)).toThrow(
      'INVALID_PARAMETER',
    );
  });

  it('requires explicit signature_version and 64-hex nonce', () => {
    expect(() =>
      assertAuthSignatureRequest({
        challenge_id: 'ab'.repeat(16),
        nonce: 'cd'.repeat(16),
        network: 'regtest',
      }),
    ).toThrow('INVALID_PARAMETER');

    expect(() =>
      assertAuthSignatureRequest({
        signature_version: 1,
        challenge_id: 'ab'.repeat(16),
        nonce: 'cd'.repeat(32),
        network: 'regtest',
      }),
    ).not.toThrow();
  });
});
