# openGym on HUAWEI FIT 5 Pro

Experimental port of the existing Apple Watch workout logic. **Full parity and hardware operation
are not verified.** The Android APK and a Lite HAP with the real Wear Engine radio adapter have
been built. The official JS SDK is included unmodified under its Apache 2.0 license and its published
SHA-256 has been verified. The watch debug certificate and device-bound Profile have been issued;
the signed HAP has passed SDK verification. Huawei service approval and device tests remain outstanding.

For the current machine and installation steps see [中文准备指南](HARMONY_SETUP_ZH.md).
All remaining user-dependent actions are grouped in [一次性处理清单](HARMONY_ACTIONS_ZH.md).

Current user scope: exclude watch-face complications and Smart Stack. Defer native system workouts,
calories and Huawei Health writing. Out-of-app punctual vibration and its phone NOTIFY fallback
are also low priority. Keep foreground rest countdown/haptics; prioritize recording, offline sync
and recovery. Background findings remain in [后台能力调查](HARMONY_BACKGROUND_ZH.md).

## Architecture and source ownership

- `harmonywatch/`: the actual DevEco-generated FA JS Lite Wearable project. Its generated
  `MainAbility` entry, SDK 26.0.0 target and 6.1.1(24) compatibility are retained. This project uses
  `host.msknet.opengym.fit`. No ArkTS phone/watch runtime is substituted.
- `frontend/harmony/watch/entry/src/main/js/default/`: canonical portable core, HML/CSS and
  platform adapter sources. Edit here and stage with `scripts/harmony/prepare.mjs`; generated
  `MainAbility` copies must stay synchronized. The pure core has Node tests in `frontend/harmony/tests`.
- The existing Android client contains the `HuaweiWatch` Capacitor bridge, using Wear Engine
  5.0.2.306. Existing workouts, history, NAS authentication and server APIs are reused. No separate
  mobile UI or new NAS endpoint is introduced.

The personal Android build selects `host.msknet.opengym.phone` via `-PpersonalApplicationId=...`.
Normal upstream builds retain their original application IDs and debug suffix. The personal APK
can coexist with an installed upstream APK; it uses its own app storage and signs into the same NAS.
Its actual development certificate fingerprint is in `harmonywatch/phone-debug-identity.json`.

## Synchronization

The existing v1 snapshot and workout events are preserved. Wire envelopes are
`kind: snapshot | snapshotAck | events | eventAck | hello | clip`. URI-escaped ASCII JSON is split
into 600-character chunks `{v:1,id,i,n,data}`, keeping even Chinese/emoji payloads under the 1 KiB
message ceiling. Each receiver bounds assembly count/size and expires incomplete transfers.
Outgoing messages/files are serialized. Wear Engine communication success is **207**, distinct
from the generic API success code 0.

Watch edits and their outbox are saved before radio transmission. Android commits incoming events
before exposing them to JS; the existing store is saved before acknowledging. Watch events are
removed only after that acknowledgement. Snapshot acknowledgement follows watch storage success.
Pending local ticks survive stale snapshots, unilateral rows merge per side, and recently finished
sessions do not reappear. A pending animation transfer is not restarted for every new set update.

Android converts built-in GIF/WebP/video resources into small PNG frames, transmits their manifest
and files, and deletes temporary frame caches. The watch only plays a complete current-workout
frame set, stops playback off-page, and clears old caches. File-path rendering still requires a device test.
The original licensed exercise media are not uploaded or altered in the catalogue.

## Build

Create the Lite project in DevEco once. `harmonywatch/build-profile.json5` is local and ignored,
so manual-signing passwords cannot accidentally be committed; the sanitized example is tracked.
The Windows build helper creates the local profile from the example if necessary.

Build the radio-enabled HAP using the included official WearEngine-LiteWearable 5.0.2.306 SDK:

```sh
node scripts/harmony/prepare.mjs --project harmonywatch --bundle host.msknet.opengym.fit
```

```powershell
.\scripts\harmony\build-local.ps1 -DevEcoRoot 'E:\Program Files\Huawei\DevEco Studio'
```

The default peer identity comes from `harmonywatch/phone-debug-identity.json`. Override it with
`--phone-package` and `--phone-fingerprint` if using another Android signing certificate. An
alternative official SDK directory may be selected with `--sdk`; it must contain `wearengine.js`.
Use `--offline` only for explicit local UI/storage builds with radio disabled.

SDK provenance, original checksums and license are in the portable source's `vendor/README.md`.
The adapter waits for the SDK's asynchronous service-version probe before subscribing. Tests run
against the unmodified SDK, checking message construction, receive callbacks and success code 207.
The API 26 `WearEngineLite` declarations are not substituted for the legacy P2pClient contract.

### Lite runtime constraints

Two engine rules break the page silently and were both present before the 2026-10-29 previewer run:

- **No regular expression literals.** One literal anywhere in the bundle fails the whole page eval;
  the previewer logs `Eval JS file failed`, `TypeError: wrong type of argument` and
  `Nothing to render as it is undefined`, and the screen stays black. `new RegExp` throws at run
  time as well. Clip names and `format()` therefore scan characters by hand
  (`common/clips.js`, `common/i18n.js`), and `tests/lite-engine.test.js` fails if a literal returns.
- **`render` belongs to the template.** DevEco sets `options.render` to the compiled template
  before `new ViewModel(options)`, so a page method called `render` is gone and `this.render()` throws
  `Expected a function` at the first state change. The page's state updater is `sync()`; the same test
  keeps it that way.

`File exceeds size limit but allowed on simulator` is not advice: `frameworks/src/core/base/js_fwk_common.h`
sets `FILE_CONTENT_LENGTH_MAX = 1024 * 48`, and `CheckFileLength()` in `js_fwk_common.cpp` only warns
under `TARGET_SIMULATOR`; on device it prints `EXCE_ACE_PAGE_FILE_TOO_HUGE` and returns false, so the
page script is never read. The limit is per JS file (the page bundle and `app.js` each have their own).
The watch is therefore split in two bundles, each inside the limit in a **release** build
(`build-local.ps1` builds release by default; `-DebugBuild` is for the previewer, which only warns):

| File | release | limit |
|---|---|---|
| `app.js` (state, radio, storage, mutations, translations) | 45,607 B | 49,152 B |
| `pages/index/index.js` (layout, view model) | 44,847 B | 49,152 B |

`getApp()` only answers when the app's options have a `data` object
(`app_data_module.cpp` reads `vm.data`), so `app.js` keeps `data: { ready: false }`; everything else
is a bound method (`attach`, `words`, `change`, `startWorkout`, `tickSet`, …). The page holds no state
and no radio code: it draws from `app.attach(fn)` and calls back.

Translations are generated as positional packs (the key names once, not once per language) and the
watch build keeps 12 of the 19 Apple Watch languages to fit: `node scripts/harmony/build-locales.mjs
--langs=en,zh-Hans,...`. Arabic, Bengali, Hungarian, Thai, Turkish, Korean and Hindi fall back to English; pass all 19 (no
`--langs`) and the app bundle goes back over 48 KB.

`scripts/harmony/check-size.mjs` gates the release build on both bundles (and `build-local.ps1` runs
it), so a page too big for the device fails the build instead of shipping. The app bundle has 3,545 bytes of headroom: a new string usually means dropping one language from `WATCH_LANGS`.

To see the previewer's pixels yourself: run the simulator, connect a WebSocket to
`ws://127.0.0.1:<lws port>/<the -sid value>` (any other path fails validation), and read the binary
frames; frame 40 bytes in starts a JPEG of the screen. That is how the layout bugs above were found.

To check a bundle without DevEco, run the packaged previewer with the same arguments the IDE uses
(`-j` points at `entry/build/default/intermediates/loader_out_lite/default/js/MainAbility`, `-url` at
`pages/index/index`, `-f` at `entry/src/main/config.json`) and read `Launch JS APP`, `show state` and
`Get first render buffer`; `Nothing to render` marks the failure.

### Watch UI parity with the Apple Watch app

`pages/index/index.hml` reproduces the SwiftUI screens one state at a time, in `RootView`'s order:
weigh-in, summary, 3-2-1, idle, hold, rest, exercise, then the finish page. `common/view.js` and
`common/format.js` hold the display rules (`formatNumber`, the effort notch model, set dots,
progress, the summary stats) and are unit tested; the page only keeps the numbers being edited.

Lite rules that shaped the layout (each one is a build error or a silent no-op, not a style choice):

- no `font-weight`, `line-height`, `position`, `overflow`, `box-shadow` or gradients; hierarchy comes
  from size and colour only;
- **no compound class selectors** (`.tag.warm`, `.round.small`): every variant is its own class;
- `class` cannot be data-bound; per-property `style="color: {{x}}"` can;
- `if` and `for` on the same tag is an error, so conditional lists pass `cond ? list : []`;
- there is no `button` tag: a button is `<input type="button">`; no `onappear` (clocks run on
  `setInterval`);
- `font-family` is fixed to HYQiHei-65S, so numbers are not monospaced like the SwiftUI `.rounded`.

Three layout rules the engine enforces silently (each was a black screen until fixed):

- **A container needs an explicit height.** A `div` with only `width` collapses and its children are
  never drawn (`col`, `names`, `numLine`, `tiles`, `row`, `roundWrap`, `editValue` all carry heights now).
- **`stack` places children at the top-left, not centred.** `.ringText` sets `top/left: 37px` to sit
  inside the 264 px ring, and the countdown number uses the same box.
- **A conditional (`if`) text inside a stack is not drawn.** The rest screen's "Next: …" and offline
  lines are unconditional; an empty string renders nothing.

Interactions ported: swipe up/down moves between exercises (the pager's pages), a tap on a tile opens
the number editor (with −/+ and the exercise's own step), a long press on Done asks to skip the set,
a 2 s long press on the idle screen opens the debug panel, and the confirmations (`All done?`,
`Skip this set?`, `Finish workout?`) are separate panels because Lite has no dialogs.

**The crown is used, through ACELite's global monitor** (`setMonitorForCrownEvents`,
`frameworks/src/core/modules/digital_crown_module.cpp`): the callback receives
`{ timestamp, angularVelocity, degree }`, so the page accumulates degrees and steps every 24° (a full
turn is 15 notches, capped at 4 per event). In the number editor it turns the value, in the weigh-in
it turns the active part, and on the exercise page it pages between exercises, exactly like Apple's
crown. `clearMonitorForCrownEvents()` runs in `onDestroy`; both calls are guarded so the previewer and
older builds still work. If a real FIT turns the other way, flip the sign in `crownStep`.

Ported down to the small states as well: the page keeps an exercise with no open set and offers the
dots ("All sets done" / "Tap a dot to do a skipped set."), the pending-sync mark sits in the exercise
header and in the rest ring, the HR badge shows "measuring" until the sensor's first sample, and a
rest that ends pulses three times with one repeat after 5 s that any touch silences.

A workout the phone ends while the watch has it running becomes a summary here, marked "Ended on
your iPhone", the way watchOS does it: `applySnapshot` sees the workout leave the snapshot, checks the
phone's `discarded` list (already sent by `lib/watch-sync.js`) and either keeps the local summary or
drops it. Only the calorie row still needs the phone or Health Service Kit, since watchOS takes kcal
from the Apple Health workout and neither side of ours has that number. Deliberate deviations: no water lock (the existing in-app touch
lock), no live calories (Health Service Kit is deferred), and the summary's time is `m:ss` rather than
a localised "52 min" because Lite has no duration formatter.


The registered Android product is openGym Phone (APP ID `119569911`); account service is enabled.
Wear Engine DEVICE_MANAGER was submitted on 2026-10-29; the console lists it as pending approval.
Both official Excel templates were filled and uploaded. The current APK has been rebuilt with this
APP ID and verified against the registered signing certificate. Rebuild with JDK 21 using:

```sh
JAVA_HOME=/path/to/jdk21 HUAWEI_APP_ID=119569911 bash scripts/harmony/build-android.sh
```

The personal build helper reads the public Android APP ID and watch peer defaults from the two
`harmonywatch/*-debug-identity.json` files; `HUAWEI_APP_ID`, `VITE_HUAWEI_WATCH_BUNDLE` and
`VITE_HUAWEI_WATCH_FINGERPRINT` can override them. Existing saved phone peer settings take precedence
over these initial UI defaults. No service secret, CSR or private key is embedded. The APP ID is
stored through an Android string resource so a numeric-looking ID remains string metadata, following
the [Wear Engine identity configuration](https://developer.huawei.com/consumer/en/doc/development/connectivity-Guides/addingappid-packagename-0000001050818013).

A direct Gradle build without APP ID still builds but refuses to initiate Wear Engine authorization. The bridge
only requests DEVICE_MANAGER. It registers receivers after consent and reconnects on later launches.
Incoming phone events remain on disk if the app process dies; reopen the app to resume syncing.

The large Android asset tree is slow to hash over WSL's Windows filesystem. A temporary Linux
build copy was used to generate the current APK, without changing the user's project location.

## Signing and artifacts

Current files are in `harmonywatch/artifacts/` (ignored): personal debug APK, radio-enabled signed
and unsigned HAPs, an earlier offline verification HAP, SHA-256 sums and status notes. Use
`openGymFIT-radio-signed.hap` for sideload testing. The APK is signed; its application ID, registered signing certificate, APP ID string resource and
compiled watch peer defaults were inspected. Copies of both current installation files are in `D:\Downloads\`.
It can be tested alongside the original client; do not uninstall the original just to test NAS login.

Unsigned HAPs cannot be installed directly. The signed HAP contains `entry-default-signed.bin`.
`verify-hap.py` validates container integrity and bin presence only; it does not perform signature verification.

A local ECC P-256 key and valid public CSR have been prepared. The CSR is
`harmonywatch/signing/opengym-fit.csr`; the private key/passwords are outside the repository with
restricted permissions. The matching AGC debug certificate and Profile were issued on 2026-10-29,
binding the supplied FIT UDID. Profile signature, bundle, device and signer certificate were checked.
Neither CSR nor private keys belong in app resources. The official SDK signed the BIN, the official
packer wrapped it, and the final HAP passed SDK `verify-app`. Do not alter the package afterward.

The installed signing JAR incorrectly dispatches `verify-app -inForm bin` to its ELF verifier.
`scripts/harmony/verify-lite-bin.py` independently checks the Lite BIN's CMS signature against the
previously verified leaf certificate, SDK chunked SHA-256 content digest and exact embedded Profile.
Tampered executable, Profile, CMS and trailer were rejected. This does not establish device acceptance.
The final ZIP was checked to contain the exact verified signed BIN. Verification flags and artifact
hash are recorded in `harmonywatch/artifacts/SIGNING_VERIFICATION.json`. Public distribution is out of scope.

## Capability and verification status

| Capability | Status |
|---|---|
| Today/other routines and phone workout pickup | Implemented; actual radio validation pending |
| Weight/reps, timed holds, sides, supersets, warmups, RPE/RIR | Implemented and covered by core tests |
| Previous values, skip/pick, body weight, start countdown | Implemented |
| Rest countdown/arc, +15 seconds, skip, display settings | Implemented in foreground; background scheduling unverified |
| Save/discard, duration/volume/PR summary, idle policy | Implemented; finish confirmations and repeated taps tested |
| Offline persistence, stale snapshot merge, queued events | Implemented; fresh-runtime restoration tested; hardware failure tests pending |
| Live/set/rest/phone-ticked heart rate | Implemented; stale display expires and rest samples are deadline-bounded; screen-off continuity unverified |
| Animations | Extraction, transfer, bounded cache and playback implemented; device rendering unverified |
| Languages | 19 existing watch packs reused for common UI labels; phone-specific wording adapted |
| Touch lock | App-level lock and long-press unlock implemented; timers continue; this does not enable system Water Lock |
| Native system workouts, calories, Huawei Health write/delete | Deferred; approval and device contract remain unresolved |
| Crown and system Water Lock | No verified FIT implementation; app touch lock is available |
| Watch-face complications / Smart Stack | Excluded by user |
| Phone launch / wake | Official Wear Engine ping supports Lite launch; SDK method verified, integration/device test pending |
| Screen-off sampling | No established Lite continuity guarantee; see background investigation |
| Out-of-app punctual vibration / phone notification fallback | Low priority; no established independent Lite scheduling guarantee |

Checks completed: previous full frontend/watch run 126 tests; latest recovery-focused run 9 page tests
and 24 portable core/runtime/official SDK tests. Other checks: 19-pack locale
consistency, mobile frontend build, Android Java compilation and personal APK assembly/signature
verification (latest identity build passed; actual authorization/radio still untested), DevEco API 26 Lite JS/HML/bin build without component/style warnings, unsigned HAP
container validation, CSR self-signature validation. No FIT hardware tests have run.

Primary references: [Lite development](https://developer.huawei.com/consumer/cn/multidevice/wearables/lite/),
[Wear Engine](https://developer.huawei.com/consumer/cn/hms/huawei-wearengine/),
[official Lite SDK](https://developer.huawei.com/consumer/cn/doc/connectivity-Library/litewearable-sdk-0000001051627695),
[official samples](https://github.com/HMS-Core/hms-wear-engine-demo),
[service application](https://developer.huawei.com/consumer/cn/doc/connectivity-guides/applying-wearengine-0000001050777982).

## 2026-10-30 regression repairs

The current watch suite passes 57 tests; the adapted frontend page suite passes 9 tests. Regression
coverage now includes delayed/corrupt storage, repeated exercise identities and old state migration,
summary navigation, invalid skip guards, and per-set heart windows. See the updated
[development report](HARMONY_WATCH_REPORT_ZH.md) and [offline Huawei references](huawei/README.md).

The release helper checks every JS file against 49,152 bytes, then uses the installed SDK
haptobin converter and packer to create a fresh Lite executable container. Hvigor only creates
a BIN automatically in debug mode, so its raw release HAP must not be used as the Lite delivery
container. Local release compilation is not publication. The optional preview switch is
`-DebugBuild`, avoiding PowerShell's built-in `-Debug` parameter.


### Native black-screen reproduction and repair (2026-10-30)

Lite `if` bindings require a boolean. A string binding such as `if="{{error}}"` does not
render an error panel when native storage fails; `!error` then hides the body and the screen
is entirely black. String bindings now explicitly use `!!value`, and array lengths use `> 0`.
Two real-page/template regressions fail before this repair and pass afterward (67 core tests).

The current SDK previewer calls native storage's failure callback. Production builds display
that error and protect unread data. `demo-snapshot.mjs --bundle` instead wraps storage in memory
inside `.demo/app.js` only; the real page and controller remain connected. Never install that
preview copy. `capture-preview.mjs --help` documents the Windows Node capture command; it uses
SDK `liteWearable/bin` as cwd so fonts resolve, reads actual JPEG frames and rejects a black
frame. Error, idle, exercise, rest, lock and summary scenes have been captured and inspected.
See the Chinese development report, section 13, for commands and artifacts.
