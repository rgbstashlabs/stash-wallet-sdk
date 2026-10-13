/**
 * stash-wallet-sdk — public entry point for third-party dApps.
 *
 *   import { StashWalletClient, detectProvider } from 'stash-wallet-sdk';
 */

export { StashWalletClient } from './client';
export { ChromeExtensionTransport } from './transports/chrome-extension';
export { InjectedProviderTransport } from './transports/injected-provider';
export type { Transport, TransportOptions } from './transports/base';
export { TransportError, normalizeErrorCode, isKnownErrorCode } from './errors';
export type { TransportErrorCode } from './errors';

export {
  detectProvider,
  getInjectedProvider,
} from './provider';
export type { StashWalletProvider, ProviderRequest } from './provider';

export {
  AUTH_PROTOCOL_VERSION,
  AUTH_MESSAGE_PREFIX,
  AUTH_KDF_SALT,
  AUTH_KDF_ITERATIONS,
  AUTH_KDF_KEY_LENGTH_BYTES,
  buildCanonicalMessage,
  buildAuthV2Message,
  validateAuthV2Context,
  assertAuthSignatureRequest,
  MSG_REQUEST_NODE_GRANT_SIGNATURE,
  MSG_REQUEST_AUTH_SIGNATURE,
  MSG_REQUEST_LSP_DELEGATION,
  MSG_REQUEST_LSP_REVOKE,
  MSG_REQUEST_NODE_CREDENTIAL,
  MSG_REQUEST_SWITCH_NETWORK,
  MSG_GET_NODE_INFO_FOR_LSP,
  MSG_GET_PROVIDER_CAPABILITIES,
  MSG_GET_WALLET_SESSION_STATUS,
  MSG_GET_BTC_ADDRESS,
  MSG_GET_HUB_CHANNELS,
  MSG_CONNECT,
  MSG_DISCONNECT,
  MSG_GET_ACCOUNTS,
  MSG_GET_NETWORK,
  MSG_SIGN_MESSAGE,
  MSG_GET_VERSION,
  MSG_GET_RGB_UTXOS,
  MSG_GET_CONTRACT_BALANCE,
  MSG_GET_CONTRACT_KNOWN,
  MSG_IMPORT_CONTRACT,
  MSG_AUTO_IMPORT_CONTRACT,
  MSG_ISSUE_CONTRACT,
  MSG_SEND_BITCOIN,
  MSG_SEND_RGB,
  MSG_PAY_LIGHTNING_INVOICE,
  MSG_GENERATE_SELL_INVOICE,
  MSG_ACCEPT_NATIVE_SWAP,
  PUBLIC_PROVIDER_METHODS,
  isPublicProviderMethod,
  PROTOCOL_VERSION,
  BRIDGE_REQUEST_SOURCE,
  BRIDGE_RESPONSE_SOURCE,
  BRIDGE_EVENT_SOURCE,
} from './protocol';
export type { AuthV2Context, PublicProviderMethod } from './protocol';

export type {
  Network,
  WalletStatus,
  NodeGrantSignatureRequest,
  NodeGrantSignatureResponse,
  AuthSignatureRequest,
  AuthSignatureRequestV1,
  AuthSignatureRequestV2,
  AuthSignatureResponse,
  WalletSessionStatus,
  NodeInfo,
  ProviderCapabilities,
  LspDelegationRequest,
  LspDelegationRegistrationParams,
  LspDelegationResponse,
  NodeCredentialRequest,
  NodeCredentialResponse,
  PayLightningInvoiceRequest,
  PayLightningInvoiceResponse,
  BtcAddressResponse,
  HubChannelsRequest,
  HubChannelInfo,
  GenerateSellInvoiceRequest,
  GenerateSellInvoiceResult,
  ConnectResult,
  AccountsResult,
  SignMessageRequest,
  SignMessageResult,
  RgbUtxoItem,
  ContractBalanceResult,
  ContractKnownResult,
  ImportContractRequest,
  ImportContractResult,
  IssueContractRequest,
  IssueContractResult,
  SendBitcoinRequest,
  SendBitcoinResult,
  SendRGBRequest,
  SendRGBResult,
  AcceptNativeSwapRequest,
  ProviderEventName,
  ProviderEventHandler,
} from './types';
