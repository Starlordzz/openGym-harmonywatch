# Android 与华为手表自签名打包

openGym for Huawei Watch 1.4.5 提供源码和本地构建流程。Android APK 使用自己的签名，华为 Lite Wearable HAP 使用与手表型号、包名和设备登记匹配的华为 Profile。当前验证机型见[兼容性记录](COMPATIBILITY_ZH.md)。

基于 Duarte Santos 的 [openGym](https://github.com/DuarteSantos8/openGym) 开发，为第三方华为手表 / HarmonyOS 适配。源码遵循 [AGPL-3.0-or-later](../../LICENSE)。训练素材和华为 SDK 的许可声明随对应目录保存。[项目声明](../../NOTICE.md) · [训练素材许可](../../catalogue/media/NOTICE.md) · [华为 Lite SDK 声明](../../frontend/harmony/watch/entry/src/main/js/default/vendor/README.md)

## 准备工作

- 获取 fork 的 `v1.4.5` 源码。如果下载了发布页附带的源码包，在下载目录执行 `sha256sum -c SHA256SUMS`。Android 构建使用 Node.js 22、JDK 21、Android SDK Platform 36、Build Tools 35.0.0 和 Gradle Wrapper。手表构建使用带 Lite Wearable SDK 的 Windows DevEco Studio。WSL 签名校验还使用 Python 3 和 OpenSSL。
- 在仓库外保管 Android 签名库、华为手表私钥和密码。在 AppGallery Connect 登记自己的手机应用包名、Android 证书指纹及手表应用包名，按账号和型号申请 Wear Engine。记录自己应用的 APP ID。[华为 Wear Engine 配置](https://developer.huawei.com/consumer/en/doc/development/connectivity-Guides/addingappid-packagename-0000001050818013)
- 在华为开发者后台申请匹配手表包名的 P-256 调试证书和 Profile，并登记用于调试的手表。把自己的公开叶证书、完整证书链和调试 Profile 分别保存为 `harmonywatch/signing/opengym-fit-leaf.cer`、`opengym-fit-chain.cer` 和 `opengym-fit-debug.p7b`。该目录由 Git 忽略。[华为 Lite Wearable 调测文档](https://developer.huawei.com/consumer/en/doc/harmonyos-guides-V2/run_fitnesswatch-0000001054134240-V2/)

## 1. 创建 Android 密钥并提取双端身份

已有用于升级的 Android 签名时，沿用该密钥和别名。首次签名可用以下命令创建 PKCS#12。`keytool` 会在终端提示输入密码。

```bash
umask 077
signing_dir="$HOME/.local/share/opengym-signing"
mkdir -p "$signing_dir"
android_key="$signing_dir/android-release.p12"

keytool -genkeypair -storetype PKCS12 -keystore "$android_key" \
  -alias opengym -keyalg RSA -keysize 3072 -validity 10000 \
  -dname 'CN=openGym Local Build'

read -r -p '已登记的 Android 包名 ' phone_package
read -r -p '已登记的华为 APP ID ' huawei_app_id
read -r -p '已登记的手表包名 ' watch_bundle

keytool -exportcert -keystore "$android_key" -alias opengym \
  -file "$signing_dir/android-release.cer"
phone_sha=$(sha256sum "$signing_dir/android-release.cer" | cut -d ' ' -f 1 | tr 'a-f' 'A-F')
watch_leaf=harmonywatch/signing/opengym-fit-leaf.cer
watch_peer=$(node --input-type=module - "$watch_bundle" "$watch_leaf" <<'JS'
import { readFileSync } from 'node:fs'
import { X509Certificate } from 'node:crypto'
import { deriveWatchFingerprint } from './scripts/harmony/watch-peer-identity.mjs'
const [bundle, certPath] = process.argv.slice(2)
console.log(deriveWatchFingerprint(bundle, new X509Certificate(readFileSync(certPath)).publicKey))
JS
)
```

`phone_sha` 是 Android 证书 SHA-256，HAP 用它识别手机。`watch_peer` 是手表包名加 Base64 编码的 P-256 公钥，Android 用它识别手表。修改任一端的包名或签名时，需要重新登记并重打受影响的配套包。[华为应用指纹规则](https://developer.huawei.com/consumer/cn/doc/harmonyos-guides/wearengine_faq-9)

## 2. 构建并签署 Android APK

以下命令接续上一步，从仓库根目录执行。指定自己的 `JAVA_HOME` 和 `ANDROID_HOME`，并把 JDK 21 的 `bin` 加入 `PATH`。

```bash
(
  set -e
  unset APP_MEDIA_DIR VITE_CLIP_EXT
  cd frontend
  npm ci --ignore-scripts --no-audit --no-fund
  VITE_MOBILE=1 VITE_HUAWEI_WATCH_BUNDLE="$watch_bundle" \
    VITE_HUAWEI_WATCH_FINGERPRINT="$watch_peer" npm run build
  node scripts/check-season-clock.mjs dist
  node ../scripts/catalogue/stage-media.mjs dist
  ./node_modules/.bin/cap sync android
  node scripts/check-mobile-bundle.mjs
  cd android
  ./gradlew :app:assembleSideloadRelease \
    "-PpersonalApplicationId=$phone_package" "-PhuaweiAppId=$huawei_app_id" \
    "-PwatchBundleName=$watch_bundle" "-PwatchPeerFingerprint=$watch_peer"
)

build_tools="$ANDROID_HOME/build-tools/35.0.0"
unsigned=frontend/android/app/build/outputs/apk/sideload/release/app-sideload-release-unsigned.apk
out="$signing_dir/output"
mkdir -p "$out"
"$build_tools/zipalign" -P 16 -f 4 "$unsigned" "$out/aligned.apk"
"$build_tools/apksigner" sign --ks "$android_key" --ks-key-alias opengym \
  --out "$out/openGym-Huawei-1.4.5.apk" "$out/aligned.apk"
"$build_tools/apksigner" verify --verbose --print-certs "$out/openGym-Huawei-1.4.5.apk"
"$build_tools/aapt" dump badging "$out/openGym-Huawei-1.4.5.apk" | head -n 1
```

把 APK 显示的签名 SHA-256 与 `phone_sha` 核对。此版 Android 的 `versionName` 为 `1.4.5`，`versionCode` 为 `46`。覆盖安装前，核对设备上的包名和签名。已有数据的手机先通过应用的导出入口备份，另用测试设备或应用身份验证安装。[Android 命令行签名指南](https://developer.android.com/build/building-cmdline#sign_cmdline)

## 3. 构建并签署 Lite Wearable HAP

用上面的 `watch_bundle`、`phone_package` 和 `phone_sha` 暂存模板。可对仓库的 DevEco 工程副本执行，以便保持检出的模板干净。

```bash
node scripts/harmony/prepare.mjs --project harmonywatch \
  --bundle "$watch_bundle" --phone-package "$phone_package" \
  --phone-fingerprint "$phone_sha"
```

在 Windows PowerShell 用实际 DevEco Studio 目录构建。普通发布构建使用 Lite JS 压缩并核对单文件 48 KiB 限制。手表包默认从空白状态启动，连接后接收计划。

```powershell
.\scripts\harmony\build-local.ps1 -DevEcoRoot $Env:DEVECO_ROOT
```

使用工程副本时，同时在 PowerShell 构建命令传入 `-ProjectPath`，并把签名步骤的 `bin_in` 改为该副本的输出路径。

在仓库外创建权限为 `0600` 的 `key-info.json`，用本机编辑器填入自己的 `keystore`、`keyAlias`、`keystorePwd` 和 `keyPwd`。`keystore` 使用 WSL 可访问的绝对路径。关闭 shell 跟踪和共享会话。签名脚本把 Java 参数放在本机私有临时目录，退出时清理。

```bash
key_info="$signing_dir/key-info.json"
sdk_default='/mnt/c/path/to/DevEco Studio/sdk/default/openharmony'
bin_in=harmonywatch/entry/build/default/outputs/default/bin/entry-default-unsigned.bin

bash scripts/harmony/sign-local.sh --sdk-default "$sdk_default" \
  --key-info "$key_info" --bin-in "$bin_in" \
  --bin-out "$out/entry-default-signed.bin" \
  --hap-out "$out/openGym-Huawei-1.4.5.hap"
```

脚本先核验 Profile，再签 BIN、封装并签 HAP，最后验证两层签名和容器。将 HAP 复制到配套手机的 `/sdcard/haps/`，通过 DevEco Assistant 安装到 Profile 中登记的手表。发布到应用市场时，按华为后台的发布证书、发布 Profile 和审核流程办理。[华为 Lite Wearable 安装指南](https://developer.huawei.com/consumer/en/doc/harmonyos-guides-V2/run_fitnesswatch-0000001054134240-V2/)

## 4. 验收与资料保管

- 使用空数据或合成训练，在测试设备验收配对、计划下发、离线记组、回连同步、休息和结束训练。通过后再连接自己的 NAS；以该实例的实际数据目录、访问域名与账号授权为准。
- 将私钥、证书申请与设备登记材料、Profile、身份 JSON、`.env`、配对码、NAS 数据和诊断日志保存在本机受限目录。设备绑定的调试 HAP 留给登记设备使用。公开源码从提交生成，离线测试数据用合成样本。
- 分发自己签出的 APK 或获准公开分发的 HAP 时，一并提供对应提交的源码、许可证、构建说明和 SHA-256。素材超出仓库已授权范围时，按各素材权利方的条款处理。[仓库发布约定](../../AGENTS.md)
