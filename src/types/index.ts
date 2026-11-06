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

export interface PlatformGrantReceipt {
  node_id: string;
  apis: string[];
  expires_at: string;
  grant_signature: string;
  grantor_public_key: string;
  wallet_type: 'stashwallet';
  network: 'regtest' | 'testnet' | 'mainnet';
  challenge_id: string;
}

export interface PlatformGrantRequest {
  client_public_key: string;
  apis: string[];
  grant_ttl_days: number;
}

export interface PlatformGrantResponse {
  grant_id: string;
  owner_id: string;
  node_id: string;
  apis: string[];
  expires_at: string;
  network: 'regtest' | 'testnet' | 'mainnet';
  grant_signature: string;
  grantor_public_key: string;
  wallet_type: 'stashwallet';
  challenge_id: string;
  grant_ttl_days?: number;
}

/**
 * Parameters passed to StashWalletClient.requestNodeRevokeSignature().
 *
 * `node_id` is the **Cloud node id** (32 lowercase hex), not a Lightning node pubkey: grants
 * and their revocations are scoped to a Cloud node, and Cloud rebuilds the signed string from
 * its own record. `display` is optional context a dApp may send for compatibility; the
 * confirmation popup always renders the authoritative record instead of this copy.
 */
export interface NodeRevokeSignatureRequest {
  /** Cloud grant id (UUID, max 36 chars). */
  grant_id: string;
  /** Cloud node id — 32 lowercase hex characters. */
  node_id: string;
  network: 'regtest' | 'testnet' | 'mainnet';
  /** Optional expiry hint; the signed review uses the record's own value. */
  expires_at?: string;
  /** Optional caller-provided context; never rendered as the authoritative review. */
  display?: {
    platform_id?: string;
    apis?: string[];
    capabilities?: string[];
  };
}

/**
 * Wallet-signed proof of a revocation intent.
 *
 * Submitted verbatim to Cloud (`POST /v3/node-access/grants/{id}/revoke` body) or forwarded by
 * the platform. `signature` is 128 lowercase hex characters (compact secp256k1 `r||s` over
 * SHA-256 of `STASH-NODE-REVOKE-V1|grant_id|node_id|network|timestamp|nonce`);
 * `public_key` is the compressed 33-byte grantor key (66 hex).
 */
export interface NodeRevokeSignatureResponse {
  grant_id: string;
  public_key: string;
  /** Unix seconds the wallet signed at; Cloud accepts ±300s. */
  timestamp: number;
  /** Single-use even-length lowercase hex nonce, 32–128 chars. */
  nonce: string;
  /** 128 lowercase hex characters. */
  signature: string;
}

/** Convenience alias: the proof itself is the response body Cloud expects. */
export type NodeRevokeProof = NodeRevokeSignatureResponse;

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

/**
 * Node balances of the wallet's own Lightning node.
 * Values are reported by the node; never recompute them client-side.
 */
export interface NodeBalancesResult {
  onchain_spendable_sats: number;
  onchain_total_sats: number;
  lightning_total_sats: number;
}

/** Auto coin-selection policy when opening an RGB channel (kebab-case, node-side enum). */
export type RgbFundingUtxoPolicy =
  | 'single-rgb-anchor'
  | 'rgb-anchor-with-btc-support'
  | 'merge-rgb-anchors-with-btc-support';

/** Role of a UTXO in the RGB channel funding transaction. */
export type RgbFundingUtxoRole = 'rgb-state' | 'fee-support';

/** One exact funding input for `rgb.funding_utxos`. */
export interface RgbFundingUtxo {
  txid: string;
  vout: number;
  role: RgbFundingUtxoRole;
}

/** RGB leg of a channel-open request. */
export interface OpenChannelRgbRequest {
  /** RGB contract / asset ID placed into the channel. */
  contract_id: string;
  /** Amount of RGB asset contributed to the channel. */
  asset_amount: string | number;
  /**
   * Explicit self-hosted color-context template.
   * Managed wallets derive it from their current node; leave unset unless self-hosting.
   */
  color_context_data?: string;
  /** Override the node's default coin selection. Mutually exclusive with `funding_utxos`. */
  funding_utxo_policy?: RgbFundingUtxoPolicy | null;
  /** Exact funding inputs. Mutually exclusive with `funding_utxo_policy`. */
  funding_utxos?: RgbFundingUtxo[] | null;
}

/**
 * Request a Lightning channel open against a peer.
 *
 * Amounts and the RGB asset amount are forwarded verbatim to the extension, which
 * validates them against the node before showing its approval UI. The SDK performs
 * no pricing or balance arithmetic.
 */
export interface OpenChannelRequest {
  /** Peer node public key. */
  node_id: string;
  /** Peer socket address (`host:port`). */
  address: string;
  /** Channel capacity in satoshis. */
  channel_amount_sats: string | number;
  /** Optional msat pushed to the counterparty on open. */
  push_to_counterparty_msat?: string;
  /** Whether the channel is publicly announced. */
  announce?: boolean;
  /** Business direction of the channel, used only for the extension's review copy. */
  channel_direction?: 'buy' | 'sell';
  /** RGB leg of the open, when the channel carries an asset. */
  rgb?: OpenChannelRgbRequest;
}

export interface OpenChannelResult {
  user_channel_id: string;
}

export interface CloseChannelRequest {
  user_channel_id: string;
  counterparty_node_id: string;
  /** Request a force close instead of a cooperative close. */
  force?: boolean;
}

export interface CloseChannelResult {
  ok: boolean;
}

export interface CreateRgbLnInvoiceRequest {
  contract_id: string;
  /** RGB asset amount to receive; converted to a decimal string before sending. */
  asset_amount: string | number;
  description?: string;
  /** Invoice expiry in seconds (extension default 3600). */
  expiry_secs?: number;
  /**
   * BTC carrier amount in msat. Omit to let the node auto-calculate and lift it.
   */
  btc_carrier_amount_msat?: string;
}

export interface CreateRgbLnInvoiceResult {
  invoice: string;
  /** Authoritative carrier embedded in the invoice (may exceed the requested value). */
  btc_carrier_amount_msat?: string;
}

export interface CreateRgbOnchainInvoiceRequest {
  contract_id: string;
  /** RGB asset amount to receive; converted to a decimal string before sending. */
  amount: string | number;
  /** Invoice expiry in seconds (extension default 30 days). */
  expiry_secs?: number;
}

export interface CreateRgbOnchainInvoiceResult {
  invoice: string;
}

export interface PayRgbLnInvoiceRequest {
  /** RGB Lightning invoice (BOLT11 with the RGB extension). */
  invoice: string;
  /** Contract ID, shown only in the extension review UI. */
  contract_id?: string;
  /** RGB amount, shown only in the extension review UI. */
  asset_amount?: string;
}

export interface PayRgbLnInvoiceResult {
  payment_id?: string;
  /** Set when the node already had a record for this payment hash. */
  status?: 'pending';
  /** True when the extension resolved the call as an already-initiated duplicate payment. */
  duplicate?: boolean;
}

export interface CreateBtcHoldInvoiceRequest {
  /** Amount in millisatoshis (positive integer). */
  amount_msat: string | number;
  description?: string;
  /** Invoice expiry in seconds; the extension caps it at 86400. */
  expiry_secs?: number;
}

export interface CreateBtcHoldInvoiceResult {
  invoice: string;
  payment_hash: string;
}

export interface CheckBtcHoldInvoiceRequest {
  payment_hash: string;
}

export interface CheckBtcHoldInvoiceResult {
  /** Lower-cased node payment status (e.g. `pending`, `succeeded`). */
  status: string;
  /** Lower-cased payment direction (e.g. `inbound`). */
  direction: string;
  /** True while the payer's HTLC is locked and claimable. */
  htlc_locked: boolean;
}

export interface ClaimBtcHoldInvoiceRequest {
  payment_hash: string;
  /** Explicit preimage. Omit to use the one the extension stored at invoice creation. */
  preimage?: string;
  /** Amount to claim in msat. Omit to use the stored invoice amount. */
  claimable_amount_msat?: string;
}

export interface ClaimBtcHoldInvoiceResult {
  ok: boolean;
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

/**
 * Wallet-signed proof of a read performed against the wallet's own node.
 *
 * `payload_json` is the raw node response; `signature` covers the canonical
 * string `STASH-LSPS1-READ-V1|network|node_id|lsp_node_id|resource|request_key|payload_sha256|read_at|nonce`.
 */
export interface Lsps1ReadReceipt {
  node_id: string;
  lsp_node_id: string;
  resource: 'info' | 'order';
  request_key: string;
  payload_json: string;
  payload_sha256: string;
  read_at: string;
  nonce: string;
  network: string;
  signer_public_key: string;
  signature: string;
}

/** Events emitted by the injected provider */
export type ProviderEventName =
  | 'accountsChanged'
  | 'networkChanged'
  | 'disconnect';

export type ProviderEventHandler = (payload: unknown) => void;
