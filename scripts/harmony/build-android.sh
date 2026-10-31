#!/usr/bin/env bash
set -euo pipefail
task_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
: "${JAVA_HOME:?Set JAVA_HOME to a JDK 21 installation}"
# These are public registered application identities, never service secrets or keys.
task_phone_identity="$task_root/harmonywatch/phone-debug-identity.json"
task_watch_identity="$task_root/harmonywatch/watch-debug-identity.json"
task_app_id="${HUAWEI_APP_ID:-$(node -e 'console.log(JSON.parse(require("fs").readFileSync(process.argv[1], "utf8")).huaweiAppId || "")' "$task_phone_identity")}"
export VITE_HUAWEI_WATCH_BUNDLE="${VITE_HUAWEI_WATCH_BUNDLE:-$(node -e 'console.log(JSON.parse(require("fs").readFileSync(process.argv[1], "utf8")).watchBundleName)' "$task_watch_identity")}"
export VITE_HUAWEI_WATCH_FINGERPRINT="${VITE_HUAWEI_WATCH_FINGERPRINT:-$(node -e 'console.log(JSON.parse(require("fs").readFileSync(process.argv[1], "utf8")).watchCertificateSha256)' "$task_watch_identity")}"
cd "$task_root/frontend"
VITE_MOBILE=1 npm run build
node ../scripts/catalogue/stage-media.mjs dist
./node_modules/.bin/cap sync android
cd android
task_args=(--no-daemon --max-workers=4 -PpersonalApplicationId=host.msknet.opengym.phone)
if [[ -n "$task_app_id" ]]; then
  task_args+=("-PhuaweiAppId=$task_app_id")
fi
"$JAVA_HOME/bin/java" -classpath gradle/wrapper/gradle-wrapper.jar org.gradle.wrapper.GradleWrapperMain "${task_args[@]}" :app:assembleSideloadDebug --console=plain
