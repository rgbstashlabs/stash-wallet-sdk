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

  it('TransportError preserves known codes', () => {
    const err = new TransportError('INVALID_PARAMETER', 'bad');
    expect(err.code).toBe('INVALID_PARAMETER');
    expect(err.message).toBe('bad');
  });

  it('forwards LSPS2 invoices without requiring a P2P address', async () => {
    const transport = mockTransport(() => ({
      invoice: { invoice: 'lnbc1' },
      quote: { fee_msat: '1000' },
      pay_within_secs: 3600,
      payment_hash: 'ab'.repeat(32),
    }));
    const client = new StashWalletClient(transport);
    const params = {
      lsp_node_id: '02' + 'cd'.repeat(32),
      amount_msat: '50000000',
      expiry_secs: 3600,
      max_fee_msat: '1000000',
      protection_until: '2027-01-01T00:00:00.000Z',
    };

    await expect(client.lsps2RequestInvoice(params)).resolves.toMatchObject({
      payment_hash: 'ab'.repeat(32),
    });
    expect(transport.send).toHaveBeenCalledWith('LSPS2_REQUEST_INVOICE', params);
  });

  it('forwards platform grant requests through the public bridge', async () => {
    const transport = mockTransport(() => ({ grant_id: 'grant-1' }));
    const client = new StashWalletClient(transport);
    const params = {
      client_public_key: '04' + '11'.repeat(64),
      apis: ['GET /api/v1/lsps2/options'],
      grant_ttl_days: 30,
    };

    await expect(client.requestPlatformGrant(params)).resolves.toEqual({ grant_id: 'grant-1' });
    expect(transport.send).toHaveBeenCalledWith('REQUEST_PLATFORM_GRANT', params);
  });

  it('forwards node revocation signatures through the public bridge', async () => {
    const proof = {
      grant_id: 'grant-1',
      public_key: '02' + 'ab'.repeat(32),
      timestamp: 1_760_000_000,
      nonce: 'cd'.repeat(16),
      signature: 'ef'.repeat(64),
    };
    const transport = mockTransport(() => proof);
    const client = new StashWalletClient(transport);
    const params = {
      grant_id: 'grant-1',
      node_id: 'ab'.repeat(16),
      network: 'testnet' as const,
      expires_at: '2027-01-01T00:00:00.000Z',
      display: { platform_id: 'rgbdex', apis: ['GET /api/v1/lsps2/options'] },
    };

    await expect(client.requestNodeRevokeSignature(params)).resolves.toEqual(proof);
    // The proof must reach Cloud verbatim: no field is renamed, dropped, or recomputed.
    expect(transport.send).toHaveBeenCalledWith('REQUEST_NODE_REVOKE_SIGNATURE', params);
  });

  describe('channel / RGB invoice capabilities', () => {
    it('reads node balances with no payload', async () => {
      const transport = mockTransport(() => ({
        onchain_spendable_sats: 1,
        onchain_total_sats: 2,
        lightning_total_sats: 3,
      }));
      const client = new StashWalletClient(transport);
      await client.getNodeBalances();
      expect(transport.send).toHaveBeenCalledWith('GET_NODE_BALANCES');
    });

    it('forwards channel open parameters verbatim', async () => {
      const transport = mockTransport(() => ({ user_channel_id: 'uc1' }));
      const client = new StashWalletClient(transport);
      const params = {
        node_id: '02' + 'ab'.repeat(32),
        address: 'hub.example:9735',
        channel_amount_sats: 1_000_000,
        rgb: { contract_id: 'rgb:contract', asset_amount: '100.5' },
      } as Parameters<typeof client.requestOpenChannel>[0];
      await expect(client.requestOpenChannel(params)).resolves.toEqual({
        user_channel_id: 'uc1',
      });
      // The SDK must not rewrite amounts; deep equality proves the payload is intact.
      expect(transport.send).toHaveBeenCalledWith('REQUEST_OPEN_CHANNEL', params);
    });

    it('sends closeChannel with the requested close mode', async () => {
      const transport = mockTransport(() => ({ ok: true }));
      const client = new StashWalletClient(transport);
      const params = {
        user_channel_id: 'uc1',
        counterparty_node_id: '02' + 'cd'.repeat(32),
        force: true,
      } as Parameters<typeof client.closeChannel>[0];
      await expect(client.closeChannel(params)).resolves.toEqual({ ok: true });
      expect(transport.send).toHaveBeenCalledWith('CLOSE_CHANNEL', params);
    });

    it('stringifies RGB amounts exactly once for both invoice kinds', async () => {
      const transport = mockTransport((type) =>
        type === 'CREATE_RGB_LN_INVOICE'
          ? { invoice: 'lntbs1', btc_carrier_amount_msat: '1500000' }
          : { invoice: 'rgb:onchain' },
      );
      const client = new StashWalletClient(transport);

      await expect(
        client.createRgbLnInvoice({
          contract_id: 'rgb:contract',
          asset_amount: 42,
          description: 'swap',
          expiry_secs: 600,
          btc_carrier_amount_msat: '1500000',
        }),
      ).resolves.toEqual({ invoice: 'lntbs1', btc_carrier_amount_msat: '1500000' });
      expect(transport.send).toHaveBeenNthCalledWith(1, 'CREATE_RGB_LN_INVOICE', {
        contract_id: 'rgb:contract',
        asset_amount: '42',
        description: 'swap',
        expiry_secs: 600,
        btc_carrier_amount_msat: '1500000',
      });

      await client.createRgbOnchainInvoice({ contract_id: 'rgb:contract', amount: 7 });
      expect(transport.send).toHaveBeenNthCalledWith(2, 'CREATE_RGB_ONCHAIN_INVOICE', {
        contract_id: 'rgb:contract',
        amount: '7',
        expiry_secs: undefined,
      });
    });

    it('pays an RGB LN invoice with display-only metadata', async () => {
      const transport = mockTransport(() => ({ payment_id: 'p1' }));
      const client = new StashWalletClient(transport);
      await client.payRgbLnInvoice({
        invoice: 'lntbs1rgb',
        contract_id: 'rgb:contract',
        asset_amount: '10',
      });
      expect(transport.send).toHaveBeenCalledWith('PAY_RGB_LN_INVOICE', {
        invoice: 'lntbs1rgb',
        contract_id: 'rgb:contract',
        asset_amount: '10',
      });
    });

    it('keeps hold-invoice amounts as decimal strings', async () => {
      const transport = mockTransport((type) => {
        if (type === 'CREATE_BTC_HOLD_INVOICE') return { invoice: 'lntbs1', payment_hash: 'hh' };
        if (type === 'CHECK_BTC_HOLD_INVOICE') {
          return { status: 'pending', direction: 'inbound', htlc_locked: true };
        }
        return { ok: true };
      });
      const client = new StashWalletClient(transport);

      await client.createBtcHoldInvoice({ amount_msat: '250000', expiry_secs: 600 });
      expect(transport.send).toHaveBeenNthCalledWith(1, 'CREATE_BTC_HOLD_INVOICE', {
        amount_msat: '250000',
        description: undefined,
        expiry_secs: 600,
      });

      await client.checkBtcHoldInvoice({ payment_hash: 'hh' });
      expect(transport.send).toHaveBeenNthCalledWith(2, 'CHECK_BTC_HOLD_INVOICE', {
        payment_hash: 'hh',
      });

      await client.claimBtcHoldInvoice({ payment_hash: 'hh' });
      expect(transport.send).toHaveBeenNthCalledWith(3, 'CLAIM_BTC_HOLD_INVOICE', {
        payment_hash: 'hh',
        preimage: undefined,
        claimable_amount_msat: undefined,
      });
    });

    it('treats getNodeInfo as an alias of getNodeInfoForLsp', async () => {
      const transport = mockTransport(() => ({
        node_base_url: 'https://node',
        node_id: '02' + 'ef'.repeat(32),
        network: 'regtest',
      }));
      const client = new StashWalletClient(transport);

      await client.getNodeInfo();
      await client.getNodeInfoForLsp();

      expect(transport.send).toHaveBeenNthCalledWith(1, 'GET_NODE_INFO_FOR_LSP');
      expect(transport.send).toHaveBeenNthCalledWith(2, 'GET_NODE_INFO_FOR_LSP');
    });
  });
});
