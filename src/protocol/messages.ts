/** Chrome / provider message type constants. */

export const MSG_REQUEST_NODE_GRANT_SIGNATURE = 'REQUEST_NODE_GRANT_SIGNATURE' as const;
export const MSG_REQUEST_AUTH_SIGNATURE = 'REQUEST_AUTH_SIGNATURE' as const;
export const MSG_REQUEST_LSP_DELEGATION = 'REQUEST_LSP_DELEGATION' as const;
export const MSG_REQUEST_LSP_REVOKE = 'REQUEST_LSP_REVOKE' as const;
export const MSG_REQUEST_NODE_CREDENTIAL = 'REQUEST_NODE_CREDENTIAL' as const;
export const MSG_REQUEST_SWITCH_NETWORK = 'REQUEST_SWITCH_NETWORK' as const;
export const MSG_GET_NODE_INFO_FOR_LSP = 'GET_NODE_INFO_FOR_LSP' as const;
export const MSG_GET_PROVIDER_CAPABILITIES = 'GET_PROVIDER_CAPABILITIES' as const;
export const MSG_GET_WALLET_SESSION_STATUS = 'GET_WALLET_SESSION_STATUS' as const;
export const MSG_GET_BTC_ADDRESS = 'GET_BTC_ADDRESS' as const;
export const MSG_GET_HUB_CHANNELS = 'GET_HUB_CHANNELS' as const;
export const MSG_CONNECT = 'CONNECT' as const;
export const MSG_DISCONNECT = 'DISCONNECT' as const;
export const MSG_GET_ACCOUNTS = 'GET_ACCOUNTS' as const;
export const MSG_GET_NETWORK = 'GET_NETWORK' as const;
export const MSG_SIGN_MESSAGE = 'SIGN_MESSAGE' as const;
export const MSG_GET_VERSION = 'GET_VERSION' as const;
export const MSG_GET_RGB_UTXOS = 'GET_RGB_UTXOS' as const;
export const MSG_GET_CONTRACT_BALANCE = 'GET_CONTRACT_BALANCE' as const;
export const MSG_GET_CONTRACT_KNOWN = 'GET_CONTRACT_KNOWN' as const;
export const MSG_IMPORT_CONTRACT = 'IMPORT_CONTRACT' as const;
export const MSG_AUTO_IMPORT_CONTRACT = 'AUTO_IMPORT_CONTRACT' as const;
export const MSG_ISSUE_CONTRACT = 'ISSUE_CONTRACT' as const;
export const MSG_SEND_BITCOIN = 'SEND_BITCOIN' as const;
export const MSG_SEND_RGB = 'SEND_RGB' as const;
export const MSG_PAY_LIGHTNING_INVOICE = 'PAY_LIGHTNING_INVOICE' as const;
export const MSG_GENERATE_SELL_INVOICE = 'GENERATE_SELL_INVOICE' as const;
export const MSG_ACCEPT_NATIVE_SWAP = 'ACCEPT_NATIVE_SWAP' as const;
export const MSG_CREATE_BTC_HOLD_INVOICE = 'CREATE_BTC_HOLD_INVOICE' as const;

/** Public methods allowed through the page ↔ content-script bridge. */
export const PUBLIC_PROVIDER_METHODS = [
  MSG_CONNECT,
  MSG_DISCONNECT,
  MSG_GET_ACCOUNTS,
  MSG_GET_NETWORK,
  MSG_GET_VERSION,
  MSG_GET_PROVIDER_CAPABILITIES,
  MSG_GET_WALLET_SESSION_STATUS,
  MSG_GET_BTC_ADDRESS,
  MSG_REQUEST_AUTH_SIGNATURE,
  MSG_REQUEST_SWITCH_NETWORK,
  MSG_SIGN_MESSAGE,
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
  MSG_GET_HUB_CHANNELS,
  MSG_GET_NODE_INFO_FOR_LSP,
  MSG_REQUEST_LSP_DELEGATION,
  MSG_REQUEST_LSP_REVOKE,
  MSG_REQUEST_NODE_CREDENTIAL,
  MSG_REQUEST_NODE_GRANT_SIGNATURE,
] as const;

export type PublicProviderMethod = (typeof PUBLIC_PROVIDER_METHODS)[number];

export function isPublicProviderMethod(type: string): type is PublicProviderMethod {
  return (PUBLIC_PROVIDER_METHODS as readonly string[]).includes(type);
}

export const PROTOCOL_VERSION = '1.0.0' as const;

/** postMessage bridge source tags */
export const BRIDGE_REQUEST_SOURCE = 'stashwallet-provider-request' as const;
export const BRIDGE_RESPONSE_SOURCE = 'stashwallet-provider-response' as const;
export const BRIDGE_EVENT_SOURCE = 'stashwallet-provider-event' as const;
