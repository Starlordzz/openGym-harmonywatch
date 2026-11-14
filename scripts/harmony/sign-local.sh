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

# The key directory is the only place the passwords live; they are read here, never printed.
eval "$(node -e '
const k = require(process.argv[1]);
const esc = s => "'"'"'" + String(s).replace(/'"'"'/g, "'"'"'\\'"'"''"'"'") + "'"'"'";
for (const [name, value] of [["KEYSTORE", k.keystore], ["ALIAS", k.keyAlias], ["KEYSTORE_PWD", k.keystorePwd], ["KEY_PWD", k.keyPwd]]) {
  if (value === undefined) throw new Error("key-info.json is missing " + name);
  console.log(name + "=" + esc(value));
}
' "$KEY_INFO")"

WORK="$(mktemp -d -t opengym-sign-XXXXXX)"
trap 'rm -rf "$WORK"' EXIT
mkdir -p "$(dirname "$BIN_OUT")" "$(dirname "$HAP_OUT")"

echo "== verify-profile"
"$JAVA" -jar "$HAP_SIGN_TOOL" verify-profile -inFile "$PROFILE" -outFile "$WORK/profile-verification.json"

echo "== sign BIN (-inForm bin)"
"$JAVA" -jar "$HAP_SIGN_TOOL" sign-app \
  -mode localSign -keyAlias "$ALIAS" -keyPwd "$KEY_PWD" \
  -appCertFile "$CERT" -profileFile "$PROFILE" -profileSigned 1 \
  -inFile "$BIN_IN" -inForm bin -signAlg SHA256withECDSA \
  -keystoreFile "$KEYSTORE" -keystorePwd "$KEYSTORE_PWD" \
  -outFile "$BIN_OUT"

echo "== pack HAP around the signed BIN"
# The HAP member name follows the packed file's basename, and the device expects the canonical
# entry-default-signed.bin (a 2026-11-02 repack was redone for exactly this reason).
HAP_TMP="$WORK/entry-default-signed.hap"
cp "$BIN_OUT" "$WORK/entry-default-signed.bin"
"$JAVA" -jar "$PACK_TOOL" --mode hap --bin-path "$WORK/entry-default-signed.bin" --out-path "$HAP_TMP" --force true

echo "== sign HAP (-inForm zip, compatibleVersion $COMPATIBLE_VERSION)"
"$JAVA" -jar "$HAP_SIGN_TOOL" sign-app \
  -mode localSign -keyAlias "$ALIAS" -keyPwd "$KEY_PWD" \
  -appCertFile "$CERT" -profileFile "$PROFILE" -profileSigned 1 \
  -inFile "$HAP_TMP" -inForm zip -signCode 1 -compatibleVersion "$COMPATIBLE_VERSION" \
  -signAlg SHA256withECDSA \
  -keystoreFile "$KEYSTORE" -keystorePwd "$KEYSTORE_PWD" \
  -outFile "$HAP_OUT"

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
