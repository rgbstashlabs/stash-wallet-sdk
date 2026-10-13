import { describe, expect, it, vi } from 'vitest';
import { StashWalletClient } from '../src/client';
import type { Transport } from '../src/transports/base';
import { TransportError } from '../src/errors';

function mockTransport(handler: (type: string, payload?: unknown) => unknown): Transport {
  const transport: Transport = {
    // Match the generic transport contract; each fixture supplies its method's result.
    async send<TPayload = unknown, TResult = unknown>(
      type: string,
      payload?: TPayload,
    ): Promise<TResult> {
      return handler(type, payload) as TResult;
    },
  };
  vi.spyOn(transport, 'send');
  return transport;
}

describe('StashWalletClient', () => {
  it('maps generateSellInvoice and acceptNativeSwap through send()', async () => {
    const transport = mockTransport((type, payload) => {
      if (type === 'GENERATE_SELL_INVOICE') return { invoice: 'lnbc1', payment_hash: 'aa' };
      if (type === 'ACCEPT_NATIVE_SWAP') return undefined;
      throw new Error(`unexpected ${type} ${JSON.stringify(payload)}`);
    });
    const client = new StashWalletClient(transport);
    await expect(client.generateSellInvoice({ amount_sats: 1000 })).resolves.toEqual({
      invoice: 'lnbc1',
      payment_hash: 'aa',
    });
    await expect(client.acceptNativeSwap({ swap_string: 'swap' })).resolves.toBeUndefined();
    expect(transport.send).toHaveBeenCalledWith('GENERATE_SELL_INVOICE', { amount_sats: 1000 });
    expect(transport.send).toHaveBeenCalledWith('ACCEPT_NATIVE_SWAP', { swap_string: 'swap' });
  });

  it('rejects auth requests missing signature_version before transport', async () => {
    const transport = mockTransport(() => ({}));
    const client = new StashWalletClient(transport);
    await expect(
      // @ts-expect-error Exercise runtime rejection of a request missing the required discriminant.
      client.requestAuthSignature({
        challenge_id: 'ab'.repeat(16),
        nonce: 'cd'.repeat(32),
        network: 'regtest',
      }),
    ).rejects.toThrow('INVALID_PARAMETER');
    expect(transport.send).not.toHaveBeenCalled();
  });

  it('sends explicit V1 and V2 auth requests without losing version-specific fields', async () => {
    const transport = mockTransport((_type, payload) => payload);
    const client = new StashWalletClient(transport);
    const common = {
      challenge_id: 'ab'.repeat(16),
      nonce: 'cd'.repeat(32),
      network: 'regtest' as const,
    };
    const v1 = { ...common, signature_version: 1 as const };
    const now = Math.floor(Date.now() / 1000);
    const v2 = {
      ...common,
      signature_version: 2 as const,
      origin: 'https://regtest.rgbdex.net',
      client_id: 'rgbdex',
      purpose: 'login' as const,
      wallet_type: 'stashwallet' as const,
      timestamp: now,
      expires_at: now + 120,
    };

    await client.requestAuthSignature(v1);
    await client.requestAuthSignature(v2);
    expect(transport.send).toHaveBeenNthCalledWith(1, 'REQUEST_AUTH_SIGNATURE', v1);
    expect(transport.send).toHaveBeenNthCalledWith(2, 'REQUEST_AUTH_SIGNATURE', v2);
  });

  it('normalizes LSP delegation aliases', async () => {
    const transport = mockTransport((_type, payload) => payload);
    const client = new StashWalletClient(transport);
    await client.requestLspDelegation({
      platform_pubkey: 'aa',
      platform: 'rgbdex',
      expiry_hours: 24,
    });
    expect(transport.send).toHaveBeenCalledWith(
      'REQUEST_LSP_DELEGATION',
      expect.objectContaining({
        recipient_pubkey: 'aa',
        service_name: 'rgbdex',
        platform_pubkey: 'aa',
      }),
    );
  });

  it('TransportError preserves known codes', () => {
    const err = new TransportError('INVALID_PARAMETER', 'bad');
    expect(err.code).toBe('INVALID_PARAMETER');
    expect(err.message).toBe('bad');
  });
});
