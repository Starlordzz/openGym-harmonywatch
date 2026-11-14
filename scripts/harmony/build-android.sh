#!/usr/bin/env bash
set -euo pipefail
task_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
: "${JAVA_HOME:?Set JAVA_HOME to a JDK 21 installation}"
# These are public registered application identities, never service secrets or keys.
task_phone_identity="$task_root/harmonywatch/phone-debug-identity.json"
task_app_id="${HUAWEI_APP_ID:-$(node -e 'console.log(JSON.parse(require("fs").readFileSync(process.argv[1], "utf8")).huaweiAppId || "")' "$task_phone_identity")}"
export VITE_HUAWEI_WATCH_BUNDLE="${VITE_HUAWEI_WATCH_BUNDLE:-$(node "$task_root/scripts/harmony/watch-peer-identity.mjs" watchBundleName)}"
export VITE_HUAWEI_WATCH_FINGERPRINT="${VITE_HUAWEI_WATCH_FINGERPRINT:-$(node "$task_root/scripts/harmony/watch-peer-identity.mjs" watchPeerFingerprint)}"
task_watch_sha256=$(node "$task_root/scripts/harmony/watch-peer-identity.mjs" watchCertificateSha256)
cd "$task_root/frontend"
VITE_MOBILE=1 npm run build
node ../scripts/catalogue/stage-media.mjs dist
./node_modules/.bin/cap sync android
cd android
task_args=(--no-daemon --max-workers=4 -PpersonalApplicationId=host.msknet.opengym.phone "-PwatchBundleName=$VITE_HUAWEI_WATCH_BUNDLE" "-PwatchPeerFingerprint=$VITE_HUAWEI_WATCH_FINGERPRINT" "-PwatchCertificateSha256=$task_watch_sha256")
# A fresh local assets copy avoids repeated Windows/WSL metadata round trips.
if [[ -n "${HARMONY_ANDROID_ASSET_CACHE:-}" ]]; then
  mkdir -p "$HARMONY_ANDROID_ASSET_CACHE"
  task_assets_dir=$(mktemp -d "$HARMONY_ANDROID_ASSET_CACHE/assets.XXXXXX")
  trap 'rm -rf -- "$task_assets_dir"' EXIT
  tar -C "$task_root/frontend/android/app/src/main/assets" -cf - . | tar -C "$task_assets_dir" -xf -
  task_args+=("-PharmonyAssetsDirectory=$task_assets_dir")
fi
if [[ -n "$task_app_id" ]]; then
  task_args+=("-PhuaweiAppId=$task_app_id")
fi
"$JAVA_HOME/bin/java" -classpath gradle/wrapper/gradle-wrapper.jar org.gradle.wrapper.GradleWrapperMain "${task_args[@]}" :app:assembleSideloadDebug --console=plain
