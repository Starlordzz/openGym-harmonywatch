#!/usr/bin/env bash
# UI / existing native-bridge iterations after build-android.sh has staged the licensed media.
set -euo pipefail
task_root=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
: "${JAVA_HOME:?Set JAVA_HOME to a JDK 21 installation}"
export VITE_HUAWEI_WATCH_BUNDLE="${VITE_HUAWEI_WATCH_BUNDLE:-$(node "$task_root/scripts/harmony/watch-peer-identity.mjs" watchBundleName)}"
export VITE_HUAWEI_WATCH_FINGERPRINT="${VITE_HUAWEI_WATCH_FINGERPRINT:-$(node "$task_root/scripts/harmony/watch-peer-identity.mjs" watchPeerFingerprint)}"
task_watch_sha256=$(node "$task_root/scripts/harmony/watch-peer-identity.mjs" watchCertificateSha256)

node --input-type=module - "$task_root" <<'JS'
import { readdirSync, existsSync, rmSync, cpSync } from 'node:fs'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
const root = process.argv[2]
const target = join(root, 'frontend/android/app/src/main/assets/public')
const media = join(target, 'exercise-media')
for (const name of ['NOTICE.md', 'still', 'clip']) {
  if (!existsSync(join(media, name))) throw Error('Run scripts/harmony/build-android.sh once to stage exercise-media before using the incremental build')
}
const output = join(root, 'harmonywatch/artifacts/android-incremental-ui')
const result = spawnSync('npm', ['run', 'build', '--', '--outDir', output, '--emptyOutDir'], {
  cwd: join(root, 'frontend'), stdio: 'inherit', env: {
    ...process.env, VITE_MOBILE: '1',
    VITE_HUAWEI_WATCH_BUNDLE: process.env.VITE_HUAWEI_WATCH_BUNDLE,
    VITE_HUAWEI_WATCH_FINGERPRINT: process.env.VITE_HUAWEI_WATCH_FINGERPRINT
  }
})
if (result.status !== 0) process.exit(result.status || 1)
if (existsSync(join(output, 'exercise-media'))) throw Error('This UI output contains exercise-media; use the full build to stage media changes')
// Refresh the web tree while retaining the previously staged exercise-media and its NOTICE.
for (const name of readdirSync(target)) if (name !== 'exercise-media') rmSync(join(target, name), { recursive: true, force: true })
for (const name of readdirSync(output)) cpSync(join(output, name), join(target, name), { recursive: true })
console.log('Updated Android web assets; retained staged exercise-media and its NOTICE.')
JS

task_app_id="${HUAWEI_APP_ID:-$(node -e 'console.log(JSON.parse(require("fs").readFileSync(process.argv[1], "utf8")).huaweiAppId || "")' "$task_root/harmonywatch/phone-debug-identity.json")}"
task_args=(--no-daemon --max-workers=4 -PpersonalApplicationId=host.msknet.opengym.phone "-PwatchBundleName=$VITE_HUAWEI_WATCH_BUNDLE" "-PwatchPeerFingerprint=$VITE_HUAWEI_WATCH_FINGERPRINT" "-PwatchCertificateSha256=$task_watch_sha256")
if [[ -n "$task_app_id" ]]; then task_args+=("-PhuaweiAppId=$task_app_id"); fi
cd "$task_root/frontend/android"
"$JAVA_HOME/bin/java" -classpath gradle/wrapper/gradle-wrapper.jar org.gradle.wrapper.GradleWrapperMain "${task_args[@]}" :app:assembleSideloadDebug --console=plain
