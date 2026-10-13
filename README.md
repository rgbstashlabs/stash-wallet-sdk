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
