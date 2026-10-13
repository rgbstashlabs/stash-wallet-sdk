/**
 * Public type definitions for stash-wallet-sdk.
 * Bump MAJOR version when any type here changes incompatibly.
 */

export type Network = 'mainnet' | 'testnet' | 'testnet4' | 'regtest';

export type WalletStatus = 'locked' | 'unlocked' | 'not_configured';

export interface NodeGrantSignatureRequest {
  node_id: string;
  apis: string[];
  client_public_key: string;
  expires_at: string;
  api_risks?: Record<string, 'read' | 'write' | 'funds' | 'control'>;
  rules?: Record<string, unknown>;
  challenge: {
    challenge_id: string;
    nonce: string;
    timestamp: number;
    expires_at: number;
    wallet_type: 'stashwallet';
    network: 'regtest';
    origin: string;
    purpose: 'grant';
    wallet_key: string;
    user_id: string;
  };
}

export interface NodeGrantSignatureResponse {
  grant_signature: string;
  grantor_public_key: string;
  wallet_type: 'stashwallet';
  network: 'regtest';
  challenge_id: string;
}

/** Auth V1 request — explicit version required. */
export interface AuthSignatureRequestV1 {
  signature_version: 1;
  challenge_id: string;
  nonce: string;
  origin?: string;
  network: Network;
}

/** Auth V2 request — preferred for new integrations. */
export interface AuthSignatureRequestV2 {
  signature_version: 2;
  challenge_id: string;
  nonce: string;
  origin?: string;
  network: Network;
  client_id: string;
  purpose: 'login';
  wallet_type: 'stashwallet';
  timestamp: number;
  expires_at: number;
}

export type AuthSignatureRequest = AuthSignatureRequestV1 | AuthSignatureRequestV2;

export interface AuthSignatureResponse {
  signature_version: 1 | 2;
  client_id?: string;
  purpose?: 'login';
  wallet_type?: 'stashwallet';
  network?: Network;
  timestamp?: number;
  expires_at?: number;
  /** Compressed secp256k1 identity public key (66 hex chars) */
  auth_pubkey: string;
  /** ECDSA secp256k1 compact signature (r||s, 128 hex chars) */
  signature: string;
  /**
   * Optional BTC address when the wallet can provide one.
   * Empty string means unbound — do not treat as a proven address.
   */
  btc_address: string;
  /**
   * Optional Lightning node id when the wallet can provide one.
   * Empty string means unbound — do not treat as node ownership proof.
   */
  node_id: string;
  message: string;
  challenge_id: string;
}

export interface WalletSessionStatus {
  status: WalletStatus;
  network: Network | null;
}

export interface NodeInfo {
  node_base_url: string;
  node_id: string;
  peer_address?: string;
  stash_wallet_id?: string;
  network: Network;
}

export interface BtcAddressResponse {
  address: string;
  network: Network;
}

export interface ProviderCapabilities {
  protocolVersion: string;
  providerVersion: string;
  canConnect: boolean;
  canIssue: boolean;
  canClaim: boolean;
  canSwap: boolean;
  canLsp: boolean;
  /** Provider/platform revocation only; Cloud idle protection is a separate API. */
  canLspRevoke: boolean;
  canAuthSign: boolean;
  /** Auth signing currently only supported on regtest */
  authNetworks: Network[];
  supportedNetworks: Network[];
}

export interface PayLightningInvoiceRequest {
  invoice: string;
  amount_msat?: string;
  channel_id?: string;
  fire_and_forget?: boolean;
  require_rgb_channel?: boolean;
}

export interface PayLightningInvoiceResponse {
  payment_id: string;
  preimage: string;
  amount_sats: string;
  destination: string;
  fee_paid_msat?: string;
}

export interface NodeCredentialRequest {
  recipient_pubkey: string;
  expiry_seconds?: number;
}

export interface NodeCredentialResponse {
  encrypted_credential: string;
  signature: string;
  auth_pubkey: string;
}

export interface LspDelegationRegistrationParams {
  token_ticker?: string;
  custom_fee_rate_percent?: number | string;
  channel_hourly_fee_sats?: number;
  p_ceiling?: number | string;
  p_floor?: number | string;
  swap_fee_lsp_percent?: number | string;
  swap_fee_platform_percent?: number | string;
  channel_fee_lsp_percent?: number | string;
  channel_fee_platform_percent?: number | string;
}

export interface LspDelegationRequest {
  /** Trusted platform pubkey (hex). Alias for legacy recipient_pubkey. */
  platform_pubkey?: string;
  recipient_pubkey?: string;
  /** Human-readable platform label. Alias for legacy service_name. */
  platform?: string;
  service_name?: string;
  expiry_hours?: number;
  registration?: LspDelegationRegistrationParams;
}

export interface LspDelegationResponse {
  encrypted_package: string;
  signature: string;
  signer_pubkey: string;
}

export interface HubChannelsRequest {
  hub_node_id?: string;
  include_pending?: boolean;
}

export interface HubChannelInfo {
  channel_id: string;
  user_channel_id?: string;
  counterparty_node_id: string;
  outbound_capacity_sats: number;
  inbound_capacity_sats: number;
  is_usable: boolean;
  is_rgb: boolean;
  rgb_contract_id?: string;
}

export interface GenerateSellInvoiceRequest {
  amount_sats: number;
  description?: string;
  expiry_secs?: number;
  token_amount?: string;
  token_ticker?: string;
  fee_sats?: number;
  total_revenue_sats?: number;
}

export interface GenerateSellInvoiceResult {
  invoice: string;
  payment_hash: string;
}

export interface ConnectResult {
  address: string;
}

export interface AccountsResult {
  address: string;
  btc_pub: string;
  rgb_pub: string;
}

export interface SignMessageRequest {
  message: string;
  origin?: string;
}

export interface SignMessageResult {
  pubkey: string;
  sign: string;
}

export interface RgbUtxoItem {
  outpoint: string;
  value_sats?: string;
  confirmed_height?: number;
  reserved: boolean;
  assets?: { contract_id: string; amount: string }[];
}

export interface ContractBalanceResult {
  contract_id: string;
  confirmed: string;
  unconfirmed: string;
}

export interface ContractKnownResult {
  contract_id: string;
  known: boolean;
}

export interface ImportContractRequest {
  contract_id: string;
  consignment_key?: string;
  origin?: string;
}

export interface ImportContractResult {
  contract_id: string;
}
export interface IssueContractRequest {
  ticker: string;
  name: string;
  supply: number;
  precision: number;
  seal?: string;
  origin?: string;
}

export interface IssueContractResult {
  id: string;
}

export interface SendBitcoinRequest {
  toAddress: string;
  satoshis: number;
  feeRate?: number;
  origin?: string;
}

export interface SendBitcoinResult {
  txid: string;
}

export interface SendRGBRequest {
  invoice: string;
  origin?: string;
}

export interface SendRGBResult {
  payment_id: string;
  txid?: string;
}

export interface AcceptNativeSwapRequest {
  swap_string: string;
}

/** Events emitted by the injected provider */
export type ProviderEventName =
  | 'accountsChanged'
  | 'networkChanged'
  | 'disconnect';

export type ProviderEventHandler = (payload: unknown) => void;
