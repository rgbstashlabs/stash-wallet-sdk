/**
 * High-level, transport-agnostic Stash Wallet client for third-party dApps.
 *
 * Usage (preferred — injected provider):
 *   import { StashWalletClient } from 'stash-wallet-sdk';
 *   const client = await StashWalletClient.connect();
 *
 * Usage (Chrome externally_connectable):
 *   import { StashWalletClient, ChromeExtensionTransport } from 'stash-wallet-sdk';
 *   const client = new StashWalletClient(new ChromeExtensionTransport());
 */

import type { Transport } from './transports/base';
import type { Lsps1ReadReceipt } from './types';
import { ChromeExtensionTransport } from './transports/chrome-extension';
import { InjectedProviderTransport } from './transports/injected-provider';
import { TransportError } from './errors';
import { assertAuthSignatureRequest } from './protocol/auth';
import {
  MSG_ACCEPT_NATIVE_SWAP,
  MSG_AUTO_IMPORT_CONTRACT,
  MSG_CHECK_BTC_HOLD_INVOICE,
  MSG_CLAIM_BTC_HOLD_INVOICE,
  MSG_CLOSE_CHANNEL,
  MSG_CONNECT,
  MSG_CREATE_BTC_HOLD_INVOICE,
  MSG_CREATE_RGB_LN_INVOICE,
  MSG_CREATE_RGB_ONCHAIN_INVOICE,
  MSG_DISCONNECT,
  MSG_GENERATE_SELL_INVOICE,
  MSG_GET_ACCOUNTS,
  MSG_GET_BTC_ADDRESS,
  MSG_GET_CONTRACT_BALANCE,
  MSG_GET_CONTRACT_KNOWN,
  MSG_GET_HUB_CHANNELS,
  MSG_GET_NETWORK,
  MSG_GET_NODE_BALANCES,
  MSG_GET_NODE_INFO_FOR_LSP,
  MSG_GET_PROVIDER_CAPABILITIES,
  MSG_GET_RGB_UTXOS,
  MSG_GET_VERSION,
  MSG_GET_WALLET_SESSION_STATUS,
  MSG_IMPORT_CONTRACT,
  MSG_ISSUE_CONTRACT,
  MSG_PAY_LIGHTNING_INVOICE,
  MSG_LSPS1_BUY_CHANNEL,
  MSG_LSPS1_READ_INFO,
  MSG_LSPS1_READ_ORDER,
  MSG_LSPS2_REQUEST_INVOICE,
  MSG_LSPS2_RGB_QUOTE,
  MSG_LSPS2_REQUEST_RGB_INVOICE,
  MSG_PAY_RGB_LN_INVOICE,
  MSG_REQUEST_AUTH_SIGNATURE,
  MSG_REQUEST_NODE_CREDENTIAL,
  MSG_REQUEST_NODE_GRANT_SIGNATURE,
  MSG_REQUEST_PLATFORM_GRANT,
  MSG_REQUEST_NODE_REVOKE_SIGNATURE,
  MSG_REQUEST_LSP_REVOKE,
  MSG_REQUEST_OPEN_CHANNEL,
  MSG_OPEN_CHANNEL_SETUP,
  MSG_REQUEST_SWITCH_NETWORK,
  MSG_SEND_BITCOIN,
  MSG_SEND_RGB,
  MSG_SIGN_MESSAGE,
} from './protocol/messages';
import type {
  AcceptNativeSwapRequest,
  AccountsResult,
  AuthSignatureRequest,
  AuthSignatureResponse,
  BtcAddressResponse,
  CheckBtcHoldInvoiceRequest,
  CheckBtcHoldInvoiceResult,
  ChannelSetupRequest,
  ChannelSetupResult,
  ClaimBtcHoldInvoiceRequest,
  ClaimBtcHoldInvoiceResult,
  CloseChannelRequest,
  CloseChannelResult,
  ConnectResult,
  ContractBalanceResult,
  ContractKnownResult,
  CreateBtcHoldInvoiceRequest,
  CreateBtcHoldInvoiceResult,
  CreateRgbLnInvoiceRequest,
  CreateRgbLnInvoiceResult,
  CreateRgbOnchainInvoiceRequest,
  CreateRgbOnchainInvoiceResult,
  GenerateSellInvoiceRequest,
  GenerateSellInvoiceResult,
  HubChannelInfo,
  HubChannelsRequest,
  ImportContractRequest,
  ImportContractResult,
  IssueContractRequest,
  IssueContractResult,
  Network,
  NodeBalancesResult,
  NodeCredentialRequest,
  NodeCredentialResponse,
  NodeGrantSignatureRequest,
  NodeGrantSignatureResponse,
  NodeRevokeSignatureRequest,
  NodeRevokeSignatureResponse,
  PlatformGrantRequest,
  PlatformGrantResponse,
  NodeInfo,
  OpenChannelRequest,
  OpenChannelResult,
  PayLightningInvoiceRequest,
  PayLightningInvoiceResponse,
  PayRgbLnInvoiceRequest,
  PayRgbLnInvoiceResult,
  ProviderCapabilities,
  RgbUtxoItem,
  SendBitcoinRequest,
  SendBitcoinResult,
  SendRGBRequest,
  SendRGBResult,
  SignMessageRequest,
  SignMessageResult,
  WalletSessionStatus,
} from './types';

export class StashWalletClient {
  private readonly _transport: Transport;

  constructor(transport?: Transport) {
    this._transport = transport ?? StashWalletClient._defaultTransport();
  }

  private static _defaultTransport(): Transport {
    if (InjectedProviderTransport.isAvailable()) {
      return new InjectedProviderTransport();
    }
    if (ChromeExtensionTransport.isAvailable()) {
      return new ChromeExtensionTransport();
    }
    throw new TransportError(
      'PROVIDER_NOT_FOUND',
      'Stash Wallet not detected. Install the extension and reload the page.',
    );
  }

  /**
   * Discover the injected provider (with wait) and return a ready client.
   * Prefer this for third-party sites.
   */
  static async connect(options?: { timeoutMs?: number }): Promise<StashWalletClient> {
    if (InjectedProviderTransport.isAvailable()) {
      return new StashWalletClient(new InjectedProviderTransport(options));
    }
    try {
      await InjectedProviderTransport.waitForProvider(options?.timeoutMs ?? 5000);
      return new StashWalletClient(new InjectedProviderTransport(options));
    } catch {
      if (ChromeExtensionTransport.isAvailable()) {
        return new StashWalletClient(new ChromeExtensionTransport(undefined, options));
      }
      throw new TransportError(
        'PROVIDER_NOT_FOUND',
        'Stash Wallet not detected. Install the extension and reload the page.',
      );
    }
  }

  /** True when either the injected provider or extension id marker is present. */
  isInstalled(): boolean {
    return InjectedProviderTransport.isAvailable() || ChromeExtensionTransport.isAvailable();
  }

  requestNodeGrantSignature(
    params: NodeGrantSignatureRequest,
  ): Promise<NodeGrantSignatureResponse> {
    return this._transport.send(MSG_REQUEST_NODE_GRANT_SIGNATURE, params);
  }

  requestPlatformGrant(params: PlatformGrantRequest): Promise<PlatformGrantResponse> {
    return this._transport.send(MSG_REQUEST_PLATFORM_GRANT, params);
  }

  /**
   * Ask the wallet to sign the revocation of a long-lived platform grant.
   *
   * Revoking an authorization needs the same wallet that granted it, so this is a dedicated
   * message: the popup shows the authoritative grant record and the wallet signs
   * `STASH-NODE-REVOKE-V1|grant_id|node_id|network|timestamp|nonce`.
   *
   * The resolved value is the exact `proof` body Cloud expects at
   * `POST /v3/node-access/grants/{id}/revoke`. Rejecting the request resolves with
   * `USER_REJECTED` and produces no signing material.
   *
   * @throws TransportError with code `USER_REJECTED`; `WALLET_LOCKED`;
   *   `NODE_NOT_CONFIGURED`; `INVALID_PARAMETER`.
   */
  requestNodeRevokeSignature(
    params: NodeRevokeSignatureRequest,
  ): Promise<NodeRevokeSignatureResponse> {
    return this._transport.send(MSG_REQUEST_NODE_REVOKE_SIGNATURE, params);
  }

  async requestAuthSignature(params: AuthSignatureRequest): Promise<AuthSignatureResponse> {
    assertAuthSignatureRequest(params);
    return this._transport.send<AuthSignatureRequest, AuthSignatureResponse>(
      MSG_REQUEST_AUTH_SIGNATURE,
      params,
    );
  }

  getWalletSessionStatus(): Promise<WalletSessionStatus> {
    return this._transport.send<void, WalletSessionStatus>(MSG_GET_WALLET_SESSION_STATUS);
  }

  /**
   * Read the wallet node's public identity (`GET_NODE_INFO_FOR_LSP`).
   *
   * Requires the `read_channels` scope. The response never contains node credentials.
   *
   * @throws TransportError with code `ORIGIN_NOT_AUTHORIZED` when the origin lacks
   *   `read_channels`; `WALLET_LOCKED`; `NODE_NOT_CONFIGURED`.
   *
   * @deprecated Alias kept for compatibility with the first release. Prefer
   *   {@link getNodeInfoForLsp}, which is the descriptive name for the same call.
   */
  getNodeInfo(): Promise<NodeInfo> {
    return this.getNodeInfoForLsp();
  }

  /**
   * Read the wallet node's public identity, the value RGBDEX records as the LSP
   * node pubkey at registration. Equivalent to {@link getNodeInfo} — same message,
   * same scope, same response. Both are kept so previously published imports keep
   * working without a breaking rename.
   *
   * Requires the `read_channels` scope.
   *
   * @throws TransportError with code `ORIGIN_NOT_AUTHORIZED` when the origin lacks
   *   `read_channels`; `WALLET_LOCKED`; `NODE_NOT_CONFIGURED`.
   */
  getNodeInfoForLsp(): Promise<NodeInfo> {
    return this._transport.send<void, NodeInfo>(MSG_GET_NODE_INFO_FOR_LSP);
  }

  getBtcAddress(): Promise<BtcAddressResponse> {
    return this._transport.send<void, BtcAddressResponse>(MSG_GET_BTC_ADDRESS);
  }

  getCapabilities(): Promise<ProviderCapabilities> {
    return this._transport.send<void, ProviderCapabilities>(MSG_GET_PROVIDER_CAPABILITIES);
  }

  switchNetwork(network: Network): Promise<{ network: Network; switched: boolean }> {
    return this._transport.send<{ network: Network }, { network: Network; switched: boolean }>(
      MSG_REQUEST_SWITCH_NETWORK,
      { network },
    );
  }

  /** Currently NOT_SUPPORTED: provider revocation must not revoke Cloud idle protection. */
  requestLspRevoke(platform: string): Promise<{ success: boolean }> {
    return this._transport.send<{ platform: string }, { success: boolean }>(
      MSG_REQUEST_LSP_REVOKE,
      { platform },
    );
  }

  requestNodeCredential(params: NodeCredentialRequest): Promise<NodeCredentialResponse> {
    return this._transport.send(MSG_REQUEST_NODE_CREDENTIAL, params);
  }

  getHubChannels(params?: HubChannelsRequest): Promise<HubChannelInfo[]> {
    return this._transport.send(MSG_GET_HUB_CHANNELS, params);
  }

  /**
   * Read the wallet node's BTC balances (on-chain spendable/total + Lightning total).
   *
   * Requires the `read_channels` scope. Silent — no extension popup.
   *
   * @throws TransportError with code `ORIGIN_NOT_AUTHORIZED` when the origin lacks
   *   `read_channels`; `WALLET_LOCKED`; `NODE_NOT_CONFIGURED`.
   */
  getNodeBalances(): Promise<NodeBalancesResult> {
    return this._transport.send<void, NodeBalancesResult>(MSG_GET_NODE_BALANCES);
  }

  /**
   * Ask the extension to open a Lightning channel against a peer.
   *
   * The extension shows its own approval UI; amounts are validated there against the
   * node, so this method never computes or adjusts them.
   *
   * Requires the `sign` scope.
   *
   * @throws TransportError with code `USER_REJECTED`; `ORIGIN_NOT_AUTHORIZED`;
   *   `APPROVAL_BUSY`; `WALLET_LOCKED`; `NODE_NOT_CONFIGURED`.
   */
  requestOpenChannel(params: OpenChannelRequest): Promise<OpenChannelResult> {
    return this._transport.send(MSG_REQUEST_OPEN_CHANNEL, params);
  }

  /**
   * Open the wallet's channel setup UI against a peer, prefilled.
   *
   * Peak convenience for LSP pages: `view: 'connect'` starts on the connect-peer
   * form, `view: 'open'` starts on the channel form. The user still submits the
   * action inside the wallet.
   *
   * Requires the `read_channels` scope.
   *
   * @throws TransportError with code `ORIGIN_NOT_AUTHORIZED`; `INVALID_PARAMETER`;
   *   `WALLET_LOCKED`; `NODE_NOT_CONFIGURED`.
   */
  openChannelSetup(params: ChannelSetupRequest): Promise<ChannelSetupResult> {
    return this._transport.send(MSG_OPEN_CHANNEL_SETUP, params);
  }

  /**
   * Cooperatively (or forcefully) close a Lightning channel.
   *
   * The extension shows its own approval UI on top of any page-level confirmation.
   *
   * Requires the `sign` scope.
   *
   * @throws TransportError with code `USER_REJECTED`; `ORIGIN_NOT_AUTHORIZED`;
   *   `INVALID_PARAMETER`; `APPROVAL_BUSY`; `WALLET_LOCKED`.
   */
  closeChannel(params: CloseChannelRequest): Promise<CloseChannelResult> {
    return this._transport.send(MSG_CLOSE_CHANNEL, params);
  }

  /**
   * Create an RGB Lightning invoice on the wallet node (receive-side of a swap).
   *
   * Silent — no extension popup. Requires the `read_channels` scope.
   *
   * @throws TransportError with code `ORIGIN_NOT_AUTHORIZED` when the origin lacks
   *   `read_channels`; `WALLET_LOCKED`; `NODE_NOT_CONFIGURED`.
   */
  createRgbLnInvoice(params: CreateRgbLnInvoiceRequest): Promise<CreateRgbLnInvoiceResult> {
    return this._transport.send<CreateRgbLnInvoiceRequest, CreateRgbLnInvoiceResult>(
      MSG_CREATE_RGB_LN_INVOICE,
      {
        contract_id: params.contract_id,
        // The extension compares decimal strings; normalize without doing any math.
        asset_amount: String(params.asset_amount),
        description: params.description,
        expiry_secs: params.expiry_secs,
        btc_carrier_amount_msat: params.btc_carrier_amount_msat,
      },
    );
  }

  /**
   * Create an RGB on-chain invoice on the wallet node (e.g. an airdrop claim).
   *
   * Silent — no extension popup. Requires the `read_channels` scope.
   *
   * @throws TransportError with code `ORIGIN_NOT_AUTHORIZED` when the origin lacks
   *   `read_channels`; `WALLET_LOCKED`; `NODE_NOT_CONFIGURED`.
   */
  createRgbOnchainInvoice(
    params: CreateRgbOnchainInvoiceRequest,
  ): Promise<CreateRgbOnchainInvoiceResult> {
    return this._transport.send<
      CreateRgbOnchainInvoiceRequest,
      CreateRgbOnchainInvoiceResult
    >(MSG_CREATE_RGB_ONCHAIN_INVOICE, {
      contract_id: params.contract_id,
      amount: String(params.amount),
      expiry_secs: params.expiry_secs,
    });
  }

  /**
   * Pay an RGB Lightning invoice from the wallet node (send-side of a swap).
   *
   * The extension shows its approval popup before paying.
   *
   * Requires the `sign` scope.
   *
   * @throws TransportError with code `USER_REJECTED`; `ORIGIN_NOT_AUTHORIZED`;
   *   `APPROVAL_BUSY`; `WALLET_LOCKED`; `NODE_NOT_CONFIGURED`.
   */
  payRgbLnInvoice(params: PayRgbLnInvoiceRequest): Promise<PayRgbLnInvoiceResult> {
    return this._transport.send<PayRgbLnInvoiceRequest, PayRgbLnInvoiceResult>(
      MSG_PAY_RGB_LN_INVOICE,
      {
        invoice: params.invoice,
        contract_id: params.contract_id,
        asset_amount: params.asset_amount,
      },
    );
  }

  /**
   * Create a BTC hold invoice whose preimage stays inside the extension (atomic swap).
   *
   * Silent — no extension popup. Requires the `sign` scope.
   *
   * @throws TransportError with code `ORIGIN_NOT_AUTHORIZED` when the origin lacks
   *   `sign`; `INVALID_PAYMENT_AMOUNT`; `INVALID_EXPIRY`; `WALLET_LOCKED`;
   *   `NODE_NOT_CONFIGURED`.
   */
  createBtcHoldInvoice(
    params: CreateBtcHoldInvoiceRequest,
  ): Promise<CreateBtcHoldInvoiceResult> {
    return this._transport.send<CreateBtcHoldInvoiceRequest, CreateBtcHoldInvoiceResult>(
      MSG_CREATE_BTC_HOLD_INVOICE,
      {
        // Forward as a decimal string: the extension's positiveInteger() check
        // rejects losses of precision that Number() would silently introduce.
        amount_msat: String(params.amount_msat),
        description: params.description,
        expiry_secs: params.expiry_secs,
      },
    );
  }

  /**
   * Check whether the payer has locked BTC into a hold invoice created by this origin.
   *
   * Silent — no extension popup. Requires the `sign` scope.
   *
   * @throws TransportError with code `ORIGIN_NOT_AUTHORIZED`; `HOLD_INVOICE_NOT_OWNED`
   *   (surfaced as `UNKNOWN`); `INVALID_PAYMENT_HASH` (surfaced as `UNKNOWN`);
   *   `WALLET_LOCKED`; `NODE_NOT_CONFIGURED`.
   */
  checkBtcHoldInvoice(
    params: CheckBtcHoldInvoiceRequest,
  ): Promise<CheckBtcHoldInvoiceResult> {
    return this._transport.send<CheckBtcHoldInvoiceRequest, CheckBtcHoldInvoiceResult>(
      MSG_CHECK_BTC_HOLD_INVOICE,
      { payment_hash: params.payment_hash },
    );
  }

  /**
   * Reveal the stored preimage to claim BTC locked in a hold invoice created by this
   * origin. The extension's claim is single-shot per payment hash.
   *
   * Silent — no extension popup. Requires the `sign` scope.
   *
   * @throws TransportError with code `ORIGIN_NOT_AUTHORIZED`; `HOLD_INVOICE_ALREADY_CLAIMED`,
   *   `HOLD_INVOICE_MISMATCH` and `HOLD_INVOICE_NOT_OWNED` (all surfaced as `UNKNOWN`);
   *   `WALLET_LOCKED`; `NODE_NOT_CONFIGURED`.
   */
  claimBtcHoldInvoice(
    params: ClaimBtcHoldInvoiceRequest,
  ): Promise<ClaimBtcHoldInvoiceResult> {
    return this._transport.send<ClaimBtcHoldInvoiceRequest, ClaimBtcHoldInvoiceResult>(
      MSG_CLAIM_BTC_HOLD_INVOICE,
      {
        payment_hash: params.payment_hash,
        preimage: params.preimage,
        claimable_amount_msat: params.claimable_amount_msat,
      },
    );
  }

  generateSellInvoice(params: GenerateSellInvoiceRequest): Promise<GenerateSellInvoiceResult> {
    return this._transport.send(MSG_GENERATE_SELL_INVOICE, params);
  }

  acceptNativeSwap(params: AcceptNativeSwapRequest): Promise<void> {
    return this._transport.send(MSG_ACCEPT_NATIVE_SWAP, params);
  }

  connect(): Promise<ConnectResult> {
    return this._transport.send<void, ConnectResult>(MSG_CONNECT);
  }

  /** Revoke this origin's site authorization (does not lock the whole wallet). */
  disconnect(): Promise<boolean> {
    return this._transport.send<void, boolean>(MSG_DISCONNECT);
  }

  getAccounts(): Promise<AccountsResult> {
    return this._transport.send<void, AccountsResult>(MSG_GET_ACCOUNTS);
  }

  getNetwork(): Promise<{ network: Network }> {
    return this._transport.send<void, { network: Network }>(MSG_GET_NETWORK);
  }

  signMessage(params: SignMessageRequest): Promise<SignMessageResult> {
    return this._transport.send(MSG_SIGN_MESSAGE, params);
  }

  getVersion(): Promise<{ version: string }> {
    return this._transport.send<void, { version: string }>(MSG_GET_VERSION);
  }

  getRgbUtxos(): Promise<RgbUtxoItem[]> {
    return this._transport.send<void, RgbUtxoItem[]>(MSG_GET_RGB_UTXOS);
  }

  getContractBalance(contract_id: string): Promise<ContractBalanceResult> {
    return this._transport.send(MSG_GET_CONTRACT_BALANCE, { contract_id });
  }

  isContractKnown(contract_id: string): Promise<ContractKnownResult> {
    return this._transport.send(MSG_GET_CONTRACT_KNOWN, { contract_id });
  }

  importContract(params: ImportContractRequest): Promise<ImportContractResult> {
    return this._transport.send(MSG_IMPORT_CONTRACT, params);
  }

  autoImportContract(
    contract_id: string,
  ): Promise<{ contract_id: string; source: string; public_url?: string }> {
    return this._transport.send(MSG_AUTO_IMPORT_CONTRACT, { contract_id });
  }

  issueContract(params: IssueContractRequest): Promise<IssueContractResult> {
    return this._transport.send(MSG_ISSUE_CONTRACT, params);
  }

  sendBitcoin(params: SendBitcoinRequest): Promise<SendBitcoinResult> {
    return this._transport.send(MSG_SEND_BITCOIN, params);
  }

  sendRGB(params: SendRGBRequest): Promise<SendRGBResult> {
    return this._transport.send(MSG_SEND_RGB, params);
  }

  /**
   * Read this wallet's own LSPS1 registry entry and return a wallet-signed
   * receipt. The dApp must forward the receipt to its backend, never read the
   * user's node directly.
   */
  lsps1ReadInfo(params: { lsp_node_id: string }): Promise<Lsps1ReadReceipt> {
    return this._transport.send(MSG_LSPS1_READ_INFO, params);
  }

  /** Read one LSPS1 order from this wallet's node and sign the snapshot. */
  lsps1ReadOrder(params: { lsp_node_id: string; order_id: string }): Promise<Lsps1ReadReceipt> {
    return this._transport.send(MSG_LSPS1_READ_ORDER, params);
  }

  /**
   * Pay a Lightning invoice. Opens extension approval when required by the wallet.
   * A page-level confirmation is NOT a substitute for wallet approval.
   */
  lsps1BuyChannel(params: {
    node_id: string;
    order_body: string;
    expected_body_sha256: string;
    lsp_address?: string;
    protection_until: string;
    amount_sat: string;
    channel_kind?: 'btc' | 'rgb';
  }): Promise<unknown> {
    return this._transport.send(MSG_LSPS1_BUY_CHANNEL, params);
  }

  lsps2RequestInvoice(params: {
    lsp_node_id: string;
    lsp_address?: string;
    amount_msat: string;
    expiry_secs: number;
    max_fee_msat?: string;
    protection_until: string;
  }): Promise<{ invoice: unknown; quote: unknown; pay_within_secs: number; payment_hash: string }> {
    return this._transport.send(MSG_LSPS2_REQUEST_INVOICE, params);
  }

  lsps2RgbQuote(params: {
    lsp_node_id: string;
    lsp_address?: string;
    contract_id: string;
    asset_amount: string;
    lsp_asset_balance: string;
    lsp_balance_sat: string;
    btc_carrier_amount_msat?: string;
    protection_until: string;
  }): Promise<{ quote: unknown; offering: unknown }> {
    return this._transport.send(MSG_LSPS2_RGB_QUOTE, params);
  }

  lsps2RequestRgbInvoice(params: {
    lsp_node_id: string;
    lsp_address?: string;
    contract_id: string;
    asset_amount: string;
    lsp_asset_balance: string;
    lsp_balance_sat: string;
    btc_carrier_amount_msat?: string;
    max_fee_sat: string;
    expiry_secs: number;
    description?: string;
    protection_until: string;
  }): Promise<unknown> {
    return this._transport.send(MSG_LSPS2_REQUEST_RGB_INVOICE, params);
  }

  payLightningInvoice(params: PayLightningInvoiceRequest): Promise<PayLightningInvoiceResponse> {
    return this._transport.send(MSG_PAY_LIGHTNING_INVOICE, params);
  }
}
