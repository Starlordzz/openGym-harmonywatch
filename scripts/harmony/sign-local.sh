#!/usr/bin/env bash
# Sign the staged Lite BIN and pack the signed HAP, mirroring the local personal-signing flow:
# verify the profile, sign the BIN (-inForm bin), pack the HAP around the signed BIN with the SDK
# app_packing_tool, then sign the HAP (-inForm zip). The keystore, its passwords and the key
# directory stay on this machine; nothing secret is stored in the repository.
#
# Usage:
#   scripts/harmony/sign-local.sh --bin-in <unsigned.bin> --bin-out <signed.bin> --hap-out <signed.hap>
#
# Optional:
#   --compatible-version N   API level written into the HAP signature block (default 24, the API
#                            level the staged module declares: build-profile compatibleSdkVersion
#                            "6.1.1(24)" and the BIN's module.json "compatible": 60101024).
#   --sdk-default PATH       OpenHarmony SDK root (default $DEVECO_SDK_HOME/default/openharmony)
#   --key-info PATH          key-info.json with keystore/keyAlias/keystorePwd/keyPwd
set -euo pipefail

BIN_IN='' BIN_OUT='' HAP_OUT='' COMPATIBLE_VERSION=24
SDK_DEFAULT="${DEVECO_SDK_HOME:-/mnt/e/Program Files/Huawei/DevEco Studio/sdk}/default/openharmony"
KEY_INFO="${KEY_INFO:-$HOME/.local/share/wsl-dev/keys/opengym-fit/key-info.json}"
while [ $# -gt 0 ]; do
  case "$1" in
    --bin-in) BIN_IN="$2"; shift 2 ;;
    --bin-out) BIN_OUT="$2"; shift 2 ;;
    --hap-out) HAP_OUT="$2"; shift 2 ;;
    --compatible-version) COMPATIBLE_VERSION="$2"; shift 2 ;;
    --sdk-default) SDK_DEFAULT="$2"; shift 2 ;;
    --key-info) KEY_INFO="$2"; shift 2 ;;
    *) echo "Unknown argument: $1" >&2; exit 2 ;;
  esac
done
[ -n "$BIN_IN" ] && [ -n "$BIN_OUT" ] && [ -n "$HAP_OUT" ] || { echo 'Need --bin-in, --bin-out and --hap-out' >&2; exit 2; }
[ -f "$BIN_IN" ] || { echo "Missing input BIN: $BIN_IN" >&2; exit 1; }
[ -f "$KEY_INFO" ] || { echo "Missing key info: $KEY_INFO" >&2; exit 1; }

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
SIGNING="$ROOT/harmonywatch/signing"
HAP_SIGN_TOOL="$SDK_DEFAULT/toolchains/lib/hap-sign-tool.jar"
PACK_TOOL="$SDK_DEFAULT/toolchains/lib/app_packing_tool.jar"
JAVA="${JAVA:-java}"
CERT="$SIGNING/opengym-fit-chain.cer"
PROFILE="$SIGNING/opengym-fit-debug.p7b"
LEAF="$SIGNING/opengym-fit-leaf.cer"
for f in "$HAP_SIGN_TOOL" "$PACK_TOOL" "$CERT" "$PROFILE" "$LEAF"; do
  [ -f "$f" ] || { echo "Missing signing input: $f" >&2; exit 1; }
done

WORK="$(mktemp -d -t opengym-sign-XXXXXX)"
trap 'rm -rf "$WORK"' EXIT
mkdir -p "$(dirname "$BIN_OUT")" "$(dirname "$HAP_OUT")"

sign_app() {
  local args_file="$WORK/sign.args"
  # A private Java argument file keeps keystore passwords out of the process command line.
  node --input-type=module - "$args_file" "$KEY_INFO" "$HAP_SIGN_TOOL" "$CERT" "$PROFILE" "$@" <<'JS'
import { readFileSync, writeFileSync } from 'node:fs'
const [argsFile, keyInfo, tool, certificate, profile, ...extra] = process.argv.slice(2)
const key = JSON.parse(readFileSync(keyInfo, 'utf8'))
for (const field of ['keystore', 'keyAlias', 'keystorePwd', 'keyPwd']) {
  if (typeof key[field] !== 'string' || !key[field].length || /[\u0000-\u001f\u007f]/.test(key[field])) {
    throw Error(`Invalid signing configuration field: ${field}`)
  }
}
const args = [
  '-jar', tool, 'sign-app', '-mode', 'localSign',
  '-keyAlias', key.keyAlias, '-keyPwd', key.keyPwd,
  '-appCertFile', certificate, '-profileFile', profile, '-profileSigned', '1',
  '-keystoreFile', key.keystore, '-keystorePwd', key.keystorePwd,
  '-signAlg', 'SHA256withECDSA', ...extra,
]
writeFileSync(argsFile, args.map(arg => JSON.stringify(arg)).join('\n') + '\n', { mode: 0o600 })
JS
  "$JAVA" "@$args_file"
  rm -f "$args_file"
}

echo "== verify-profile"
"$JAVA" -jar "$HAP_SIGN_TOOL" verify-profile -inFile "$PROFILE" -outFile "$WORK/profile-verification.json"

echo "== sign BIN (-inForm bin)"
sign_app -inFile "$BIN_IN" -inForm bin -outFile "$BIN_OUT"

echo "== pack HAP around the signed BIN"
# The HAP member name follows the packed file's basename, and the device expects the canonical
# entry-default-signed.bin (a 2026-11-02 repack was redone for exactly this reason).
HAP_TMP="$WORK/entry-default-signed.hap"
cp "$BIN_OUT" "$WORK/entry-default-signed.bin"
"$JAVA" -jar "$PACK_TOOL" --mode hap --bin-path "$WORK/entry-default-signed.bin" --out-path "$HAP_TMP" --force true

echo "== sign HAP (-inForm zip, compatibleVersion $COMPATIBLE_VERSION)"
sign_app -inFile "$HAP_TMP" -inForm zip -signCode 1 \
  -compatibleVersion "$COMPATIBLE_VERSION" -outFile "$HAP_OUT"

echo "== verify-app"
"$JAVA" -jar "$HAP_SIGN_TOOL" verify-app -inFile "$HAP_OUT" -inForm zip \
  -outCertChain "$WORK/verified-chain.cer" -outProfile "$WORK/verified-profile.p7b"

echo "== verify-hap.py"
python3 "$ROOT/scripts/harmony/verify-hap.py" "$HAP_OUT"

echo "== verify-lite-bin.py"
python3 "$ROOT/scripts/harmony/verify-lite-bin.py" "$BIN_OUT" --profile "$PROFILE" --certificate "$LEAF"

echo "== hashes"
sha256sum "$BIN_OUT" "$HAP_OUT"
wc -c "$BIN_OUT" "$HAP_OUT"
echo "Signed: $HAP_OUT"
