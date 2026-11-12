# stash-wallet-sdk

Official TypeScript / JavaScript SDK for integrating **Stash Wallet** into third-party dApps.

## Download and build from Git

Get the SDK source from `git@github.com:rgbstashlabs/stash-wallet-sdk.git`. You need Git, Node.js, npm, and an SSH key configured for GitHub access.

Run these commands in the parent directory of your application project:

```bash
git clone git@github.com:rgbstashlabs/stash-wallet-sdk.git
cd stash-wallet-sdk
npm ci --include=dev
npm run build
```

`npm ci` installs build dependencies. The source repository does not include `dist/`; build it before using the SDK.

### Use in a JavaScript / TypeScript project

From your application project root, install the local SDK directory. This assumes your application and `stash-wallet-sdk/` share a parent directory; adjust the path otherwise:

```bash
npm install ../stash-wallet-sdk
```

This adds a local dependency. Keep importing from `'stash-wallet-sdk'` as shown below. CI and other development environments must also check out and build the SDK at the same relative path. Pin a verified Git tag or commit for reproducible use.

### Use in a plain HTML page

Copy `dist/stash-wallet-sdk.umd.js` to your site's static assets and host it yourself. The following example assumes it is available at `/assets/stash-wallet-sdk.umd.js`; this is not a hosted CDN:

```html
<script src="/assets/stash-wallet-sdk.umd.js"></script>
<script>
  const { StashWalletClient } = window.StashWalletSDK;
</script>
```

## Quick start

```ts
import { StashWalletClient, detectProvider } from 'stash-wallet-sdk';

const provider = await detectProvider();
if (!provider) throw new Error('Install Stash Wallet');

const client = await StashWalletClient.connect();
await client.connect(); // user approves site access

const { network } = await client.getNetwork();
const accounts = await client.getAccounts();
```

## Auth V2 (dApp login)

1. Your backend issues a V2 challenge (`challenge_id` 32 hex, `nonce` 64 hex, full V2 context).
2. Call `client.requestAuthSignature({ signature_version: 2, ...challengeFields })`.
3. Send `auth_pubkey` + `signature` + the same V2 fields to your backend for verification.

The SDK never holds private keys. Signature verification is the backend's responsibility.

Identity login currently signs only on **regtest**. Check `getCapabilities().canAuthSign` / `authNetworks`.

## Transports

| Transport | When |
|-----------|------|
| `InjectedProviderTransport` (`window.stashwallet`) | Preferred for any HTTPS site |
| `ChromeExtensionTransport` | Legacy `externally_connectable` allowlist |

`StashWalletClient.connect()` auto-detects the injected provider first.

`ChromeExtensionTransport.isAvailable()` is true only when an extension id resolves **and**
`chrome.runtime.sendMessage` exists on this page. A resolved id alone is not proof of
installation: a server-injected `window.__ENV__.VITE_STASH_WALLET_EXTENSION_ID` reaches every
visitor, including those who never installed the extension. When the two disagree the
transport throws `EXTENSION_NOT_FOUND` with a message that names both causes — not installed,
or this origin is missing from the extension's `externally_connectable` allowlist.

## Re-authorization event

When the extension rejects a call because this origin is no longer authorized, both
transports dispatch a page event before rejecting, so the page can reopen its login flow:

```ts
window.addEventListener('walletAuthRequired', (event) => {
  event.detail.reason; // 'ORIGIN_NOT_AUTHORIZED'
});
```

The rejection still reaches the caller as a `TransportError` with
`code === 'ORIGIN_NOT_AUTHORIZED'`. The event is best-effort: it is never dispatched
outside a browser context, and it never replaces the transport error.

## Node, channel, and RGB invoice methods

These cover the flows a DEX needs on top of payments. Scope requirements come from the
extension; a missing scope rejects with `ORIGIN_NOT_AUTHORIZED`.

| Method | Message | Extension scope |
|--------|---------|-----------------|
| `getNodeInfoForLsp()` | `GET_NODE_INFO_FOR_LSP` | `read_channels` |
| `getNodeBalances()` | `GET_NODE_BALANCES` | `read_channels` |
| `getHubChannels(params?)` | `GET_HUB_CHANNELS` | `read_channels` |
| `connectPeer(params)` | `CONNECT_PEER` | `read_channels` |
| `createRgbLnInvoice(params)` | `CREATE_RGB_LN_INVOICE` | `read_channels` |
| `createRgbOnchainInvoice(params)` | `CREATE_RGB_ONCHAIN_INVOICE` | `read_channels` |
| `requestOpenChannel(params)` | `REQUEST_OPEN_CHANNEL` | `sign` |
| `openChannelSetup(params)` | `OPEN_CHANNEL_SETUP` | `read_channels` |
| `closeChannel(params)` | `CLOSE_CHANNEL` | `sign` |
| `payRgbLnInvoice(params)` | `PAY_RGB_LN_INVOICE` | `sign` |
| `createBtcHoldInvoice(params)` | `CREATE_BTC_HOLD_INVOICE` | `sign` |
| `checkBtcHoldInvoice(params)` | `CHECK_BTC_HOLD_INVOICE` | `sign` |
| `claimBtcHoldInvoice(params)` | `CLAIM_BTC_HOLD_INVOICE` | `sign` |

`getNodeInfo()` remains available as a compatibility alias of `getNodeInfoForLsp()`;
both send the same message.

Amounts and RGB asset amounts are forwarded to the extension verbatim. The node validates
them before its approval UI, so the SDK performs no pricing or balance arithmetic —
an application is still responsible for its own quotes and slippage checks.

## Security boundaries

- Site authorization and fund movements require **extension UI approval**.
- Page-level confirmation is not a wallet authorization.
- Request timeouts do **not** cancel on-chain / Lightning operations.
- Do not treat empty `btc_address` / `node_id` as ownership proof.
- RGBDEX JWT, invite lists, and platform grants are **application concerns**, not part of this SDK.

## Build

```bash
npm install
npm test
npm run build
```

Outputs: ESM (`dist/index.js`), CJS (`dist/index.cjs`), UMD (`dist/stash-wallet-sdk.umd.js`), and `.d.ts`.
