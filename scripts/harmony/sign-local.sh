#!/usr/bin/env bash
# Sign the staged Lite BIN and pack the signed HAP, mirroring the local personal-signing flow:
# verify the profile, sign the BIN (-inForm bin), pack the HAP around the signed BIN with the SDK
# app_packing_tool, then sign the HAP (-inForm zip). The keystore, its passwords and the key
# directory stay on this machine; nothing secret is stored in the repository.
#
# Usage:
#   scripts/harmony/sign-local.sh --bin-in <unsigned.bin> --bin-out <signed.bin> --hap-out <signed.hap>
#   scripts/harmony/sign-local.sh --module entry|round
#
# Run --help for every option. --module fills the three paths from that module's build outputs
# (scripts/harmony/build-local.ps1 -Module entry|round) and refuses to start while the module is
# unbuilt; without --module the three path flags stay mandatory, exactly as before.
set -euo pipefail

usage() {
  cat <<'EOF'
Sign a staged Lite BIN and pack the signed HAP: verify Profile -> sign BIN -> pack HAP -> sign HAP.

Usage:
  scripts/harmony/sign-local.sh --module entry|round
  scripts/harmony/sign-local.sh --bin-in <unsigned.bin> --bin-out <signed.bin> --hap-out <signed.hap>

Options:
  --module NAME, -Module NAME
                      Sign one module of the staged project (entry = 408x480 rect, round = 466x466
                      circle) and fill only the paths you leave out, from the outputs written by
                      scripts/harmony/build-local.ps1 -Module NAME:
                        --bin-in   harmonywatch/NAME/build/default/outputs/default/bin/NAME-default-unsigned.bin
                        --bin-out  harmonywatch/NAME/build/default/outputs/default/bin/NAME-default-signed.bin
                        --hap-out  harmonywatch/NAME/build/default/outputs/default/NAME-default-signed.hap
                      The unsigned BIN and the module's packed NAME-default-unsigned.hap must exist,
                      so build the module first. Without --module all three path flags are required.
  --bin-in PATH       Unsigned Lite BIN to sign.
  --bin-out PATH      Where to write the signed BIN.
  --hap-out PATH      Where to write the signed HAP.
  --compatible-version N
                      API level written into the HAP signature block (default 12).
  --sdk-default PATH  OpenHarmony SDK root (default $DEVECO_SDK_HOME/default/openharmony).
  --key-info PATH     key-info.json with keystore/keyAlias/keystorePwd/keyPwd.
  -h, --help          Show this help.

The keystore, its passwords, the certificate chain and the Profile stay on this machine; nothing
secret is stored in the repository.
EOF
}

BIN_IN='' BIN_OUT='' HAP_OUT='' MODULE='' COMPATIBLE_VERSION=12
COMPATIBLE_VERSION_GIVEN=''
SDK_DEFAULT="${DEVECO_SDK_HOME:-/mnt/e/Program Files/Huawei/DevEco Studio/sdk}/default/openharmony"
KEY_INFO="${KEY_INFO:-$HOME/.local/share/wsl-dev/keys/opengym-fit/key-info.json}"
while [ $# -gt 0 ]; do
  case "$1" in
    --bin-in) BIN_IN="$2"; shift 2 ;;
    --bin-out) BIN_OUT="$2"; shift 2 ;;
    --hap-out) HAP_OUT="$2"; shift 2 ;;
    --module|-module|-Module|--Module) MODULE="$2"; shift 2 ;;
    --compatible-version) COMPATIBLE_VERSION="$2"; COMPATIBLE_VERSION_GIVEN=1; shift 2 ;;
    --sdk-default) SDK_DEFAULT="$2"; shift 2 ;;
    --key-info) KEY_INFO="$2"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown argument: $1" >&2; echo 'Try --help.' >&2; exit 2 ;;
  esac
done

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
MODULE_NAME="${MODULE:-entry}"
HAP_OUT_DEFAULTED=''
if [ -n "$MODULE" ]; then
  case "$MODULE" in
    entry|round) ;;
    *) echo "Unknown module: $MODULE (expected entry or round)" >&2; exit 2 ;;
  esac
  MODULE_DIR="$ROOT/harmonywatch/$MODULE"
  OUTPUT_DIR="$MODULE_DIR/build/default/outputs/default"
  [ -f "$MODULE_DIR/src/main/config.json" ] || {
    echo "Module $MODULE is not staged: $MODULE_DIR/src/main/config.json" >&2; exit 1; }
  [ -n "$BIN_IN" ] || BIN_IN="$OUTPUT_DIR/bin/$MODULE-default-unsigned.bin"
  [ -n "$BIN_OUT" ] || BIN_OUT="$OUTPUT_DIR/bin/$MODULE-default-signed.bin"
  if [ -z "$HAP_OUT" ]; then
    HAP_OUT="$OUTPUT_DIR/$MODULE-default-signed.hap"
    HAP_OUT_DEFAULTED=1
  fi
fi

[ -n "$BIN_IN" ] && [ -n "$BIN_OUT" ] && [ -n "$HAP_OUT" ] || {
  echo 'Need --bin-in, --bin-out and --hap-out, or --module entry|round' >&2; exit 2; }
echo "== module ${MODULE:-entry (paths given explicitly)}"
echo "   BIN in:  $BIN_IN"
echo "   BIN out: $BIN_OUT"
echo "   HAP out: $HAP_OUT"
[ -f "$BIN_IN" ] || {
  echo "Missing input BIN: $BIN_IN${MODULE:+ -- build it with scripts/harmony/build-local.ps1 -Module $MODULE}" >&2
  exit 1; }
if [ -n "$HAP_OUT_DEFAULTED" ]; then
  UNSIGNED_HAP="$OUTPUT_DIR/$MODULE-default-unsigned.hap"
  [ -f "$UNSIGNED_HAP" ] || {
    echo "Missing packed module HAP: $UNSIGNED_HAP -- build it with scripts/harmony/build-local.ps1 -Module $MODULE" >&2
    exit 1; }
fi
[ -f "$KEY_INFO" ] || { echo "Missing key info: $KEY_INFO" >&2; exit 1; }
if [ -z "$COMPATIBLE_VERSION_GIVEN" ]; then
  echo "note: --compatible-version defaults to $COMPATIBLE_VERSION; pass the API level the built module" >&2
  echo "      declares (the staged template declares compatible 50000012, i.e. 12)." >&2
fi

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
# The HAP member name follows the packed file's basename. Each module mirrors its own packed
# <module>-default-unsigned.bin (build-local.ps1 packs that name), so entry keeps the canonical
# entry-default-signed.bin (a 2026-11-02 repack was redone for exactly this reason) and round packs
# round-default-signed.bin.
BIN_MEMBER="$MODULE_NAME-default-signed.bin"
HAP_TMP="$WORK/${BIN_MEMBER%.bin}.hap"
cp "$BIN_OUT" "$WORK/$BIN_MEMBER"
"$JAVA" -jar "$PACK_TOOL" --mode hap --bin-path "$WORK/$BIN_MEMBER" --out-path "$HAP_TMP" --force true

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
