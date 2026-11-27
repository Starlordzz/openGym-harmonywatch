# 交给 Agent 自签打包

首次配置在本机完成。准备自己的 Android 密钥、华为调试证书和 Profile，并登记应用身份及手表。配好后，把下面的提示词交给能操作本机终端的 Agent。已配置环境可从检出源码运行到产生已验签的 APK、HAP 和 SHA-256。工具链及身份配置见[自签名打包指南](SELF_SIGNING_ZH.md)。

## 可复制提示词

```text
请在本机为 openGym-harmonywatch 构建、签名并校验 Android APK 和华为 Lite Wearable HAP。目标默认是 fork 的 v1.4.6；如果我给出提交或标签，以我指定的版本为准。交付到本机输出目录。

1. 在独立检出目录获取 https://github.com/Starlordzz/openGym-harmonywatch 的目标版本，记录提交 SHA。阅读 AGENTS.md、docs/harmony/SELF_SIGNING_ZH.md 和 docs/harmony/AGENT_PACKAGING_ZH.md。使用所检出版本的构建脚本，保留原作者署名和许可。
2. 从本机环境变量 OPENGYM_PACKAGING_CONFIG 指向的配置文件取得工具链、已登记的双端应用身份、签名材料路径和输出目录。先按文档检查所有输入。本机文件负责提供密码和密钥，对话及构建日志仅记录阶段状态和结果。检查签名材料是否可读，发现缺项时集中列出缺项和对应平台操作，继续完成可独立验证的步骤。
3. 从 Android 密钥库导出证书，计算 SHA-256；从手表叶证书派生对应包名的 P-256 公钥指纹。把手表身份传入 Android 的 Vite 和 Gradle 参数，再把 Android 包名及证书 SHA-256 传给 prepare.mjs。手表暂存使用普通空状态构建。只使用对应版本自带的 180 px 训练素材。
4. 构建 Android 的 assembleSideloadRelease。用 zipalign 对齐，用自己的 Android 密钥签名，再用 apksigner 和 aapt 核对签名、包名与版本。通过 Windows DevEco 脚本构建 Lite BIN，执行 48 KiB 检查，再在 WSL 用 sign-local.sh 验证 Profile、签署 BIN/HAP 并验签。
5. 在本机输出目录保留通过校验的 APK、HAP、SHA256SUMS 和简要构建记录。核对摘要、源码提交、包身份和两个平台的验签结果。整理重试产生的中间文件和临时签名配置。回复产物路径、校验结果和仍需实机确认的项目。安装、上传和部署各自按我另行指定的操作执行。
```

## 本机配置

把配置文件放在仓库外的受限目录。通过 `OPENGYM_PACKAGING_CONFIG` 提供文件路径。Android 和 HAP 签名配置内的文件名可自行选择，密钥和密码继续从本机文件读取。Windows DevEco 路径供 PowerShell 使用，SDK、证书及配置的 WSL 路径供 Node、Java 与 Bash 使用。

```json
{
  "android": {
    "package": "example.opengym.phone",
    "appId": "YOUR_REGISTERED_APP_ID",
    "javaHome": "/path/to/jdk-21",
    "sdk": "/path/to/android-sdk",
    "keystore": "/private/android-release.p12",
    "alias": "opengym",
    "storePasswordFile": "/private/android-store-password"
  },
  "watch": {
    "bundle": "example.opengym.watch",
    "devEcoRootWindows": "C:\\Program Files\\Huawei\\DevEco Studio",
    "sdkDefaultWsl": "/mnt/c/Program Files/Huawei/DevEco Studio/sdk/default/openharmony",
    "leafCertificate": "/private/watch-leaf.cer",
    "certificateChain": "/private/watch-chain.cer",
    "debugProfile": "/private/watch-debug.p7b",
    "keyInfo": "/private/watch-key-info.json"
  },
  "outputDir": "/path/to/local-output"
}
```

- Android 的非交互导出使用 `keytool -exportcert -storepass:file <密码文件>`。APK 签名使用 `apksigner sign --ks-pass file:<密码文件>`。独立的密钥密码可从可选配置 `android.keyPasswordFile` 读入 `--key-pass file:<密码文件>`。在日志中保留验签状态即可。
- 手表签名前，把配置中的叶证书、证书链和调试 Profile 放入独立检出的 `harmonywatch/signing/`，按[自签名指南](SELF_SIGNING_ZH.md)命名。通过 `--key-info` 传本机配置路径。输出 `--bin-out` 可放在临时目录，交付使用通过两层验签的 HAP。
- 首次华为账号授权、注册设备和签发 Profile 需由账号持有人完成。实机安装前核对既有签名和包名，区分覆盖升级与全新安装。
