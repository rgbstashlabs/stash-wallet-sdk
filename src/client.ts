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
import { ChromeExtensionTransport } from './transports/chrome-extension';
import { InjectedProviderTransport } from './transports/injected-provider';
import { TransportError } from './errors';
import { assertAuthSignatureRequest } from './protocol/auth';
import {
  MSG_ACCEPT_NATIVE_SWAP,
  MSG_AUTO_IMPORT_CONTRACT,
  MSG_CONNECT,
  MSG_DISCONNECT,
  MSG_GENERATE_SELL_INVOICE,
  MSG_GET_ACCOUNTS,
  MSG_GET_BTC_ADDRESS,
  MSG_GET_CONTRACT_BALANCE,
  MSG_GET_CONTRACT_KNOWN,
  MSG_GET_HUB_CHANNELS,
  MSG_GET_NETWORK,
  MSG_GET_NODE_INFO_FOR_LSP,
  MSG_GET_PROVIDER_CAPABILITIES,
  MSG_GET_RGB_UTXOS,
  MSG_GET_VERSION,
  MSG_GET_WALLET_SESSION_STATUS,
  MSG_IMPORT_CONTRACT,
  MSG_ISSUE_CONTRACT,
  MSG_PAY_LIGHTNING_INVOICE,
  MSG_REQUEST_AUTH_SIGNATURE,
  MSG_REQUEST_NODE_CREDENTIAL,
  MSG_REQUEST_NODE_GRANT_SIGNATURE,
  MSG_REQUEST_LSP_DELEGATION,
  MSG_REQUEST_LSP_REVOKE,
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
  ConnectResult,
  ContractBalanceResult,
  ContractKnownResult,
  GenerateSellInvoiceRequest,
  GenerateSellInvoiceResult,
  HubChannelInfo,
  HubChannelsRequest,
  ImportContractRequest,
  ImportContractResult,
  IssueContractRequest,
  IssueContractResult,
  Network,
  NodeCredentialRequest,
  NodeCredentialResponse,
  NodeGrantSignatureRequest,
  NodeGrantSignatureResponse,
  NodeInfo,
  PayLightningInvoiceRequest,
  PayLightningInvoiceResponse,
  ProviderCapabilities,
  RgbUtxoItem,
  LspDelegationRequest,
  LspDelegationResponse,
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

  getNodeInfo(): Promise<NodeInfo> {
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

  requestLspDelegation(params: LspDelegationRequest): Promise<LspDelegationResponse> {
    const normalized: LspDelegationRequest = {
      ...params,
      recipient_pubkey: params.recipient_pubkey ?? params.platform_pubkey,
      service_name: params.service_name ?? params.platform,
    };
    return this._transport.send(MSG_REQUEST_LSP_DELEGATION, normalized);
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
   * Pay a Lightning invoice. Opens extension approval when required by the wallet.
   * A page-level confirmation is NOT a substitute for wallet approval.
   */
  payLightningInvoice(params: PayLightningInvoiceRequest): Promise<PayLightningInvoiceResponse> {
    return this._transport.send(MSG_PAY_LIGHTNING_INVOICE, params);
  }
}
