#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PUBLISH=false
SKIP_INSTALL=false

usage() {
  printf '%s\n' \
    'Usage: bash build.sh [--publish] [--skip-install] [--help]' \
    '' \
    'Default: install dependencies, type-check, test, build, and preview the npm publish contents without publishing.' \
    '' \
    '  --publish       Verify npm login status, then publish the public package after confirmation' \
    '  --skip-install  Reuse the existing node_modules without running npm ci' \
    '  --help          Show this help' \
    '' \
    'Run npm login before the first publish; run npm version patch/minor/major to bump the version first.' \
    'This script does not log in, change the version, or create Git commits or tags.'
}

for arg in "$@"; do
  case "$arg" in
    --publish) PUBLISH=true ;;
    --skip-install) SKIP_INSTALL=true ;;
    --help|-h) usage; exit 0 ;;
    *) printf 'Unknown argument: %s\n' "$arg" >&2; usage >&2; exit 1 ;;
  esac
done

trap 'printf "Failed at line %s; aborting.\n" "$LINENO" >&2' ERR

cd "$SCRIPT_DIR"
for tool in node npm; do
  if ! command -v "$tool" >/dev/null 2>&1; then
    printf 'Missing %s; please install Node.js and npm first.\n' "$tool" >&2
    exit 1
  fi
done

PACKAGE_NAME="$(node -p 'JSON.parse(require("fs").readFileSync("package.json", "utf8")).name')"
PACKAGE_VERSION="$(node -p 'JSON.parse(require("fs").readFileSync("package.json", "utf8")).version')"
printf 'Preparing to build %s@%s\n' "$PACKAGE_NAME" "$PACKAGE_VERSION"

if "$PUBLISH"; then
  REGISTRY="$(npm config get registry)"
  printf 'Publish target registry: %s\n' "$REGISTRY"
  if ! npm whoami --registry "$REGISTRY"; then
    printf 'Unable to confirm npm login status; check your network and registry config, then run npm login.\n' >&2
    exit 1
  fi
fi

if "$SKIP_INSTALL"; then
  if [[ ! -d node_modules ]]; then
    printf 'node_modules not found; rerun without --skip-install.\n' >&2
    exit 1
  fi
else
  printf '\n[1/5] Installing locked dependencies\n'
  npm ci --include=dev
fi

printf '\n[2/5] TypeScript type check\n'
npm run type-check

printf '\n[3/5] Running tests\n'
npm test

printf '\n[4/5] Building the SDK\n'
npm run build

printf '\n[5/5] Previewing npm publish files\n'
# The build above already ran prepack's build command.
npm pack --dry-run --ignore-scripts

if "$PUBLISH"; then
  printf '\nAbout to publish %s@%s publicly to %s.\n' "$PACKAGE_NAME" "$PACKAGE_VERSION" "$REGISTRY"
  printf 'Review the file list above and confirm no sensitive content. Type publish to confirm, any other input cancels: '
  confirmation=''
  if ! IFS= read -r confirmation || [[ "$confirmation" != 'publish' ]]; then
    printf '\nPublish cancelled.\n'
    exit 1
  fi
  npm publish --access public --registry "$REGISTRY"
  printf '\nPublished: %s@%s\n' "$PACKAGE_NAME" "$PACKAGE_VERSION"
else
  printf '\nBuild and checks complete; not published to npm. To publish, run: bash build.sh --publish\n'
fi
