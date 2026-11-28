package ch.duartesantos.opengym;

import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Handler;
import android.os.Looper;
import com.getcapacitor.*;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.huawei.wearengine.HiWear;
import com.huawei.wearengine.auth.AuthCallback;
import com.huawei.wearengine.auth.Permission;
import com.huawei.wearengine.device.Device;
import com.huawei.wearengine.p2p.*;
import org.json.*;
import java.nio.charset.StandardCharsets;
import java.io.File;
import java.util.*;

/** Explicit opt-in. Events stay durable until JS has saved them and calls ack. */
@CapacitorPlugin(name = "HuaweiWatch")
public class HuaweiWatchPlugin extends Plugin {
    private static final int MAX_EVENTS = 500;
    private final Handler main = new Handler(Looper.getMainLooper());
    private P2pClient client;
    private Device device;
    private SharedPreferences prefs;
    private boolean installed;
    private boolean refreshing;
    private boolean receiverRegistered;
    private long lastDiscovery;
    private long lastHelloRequest;
    private int receivedPackets;
    private Integer lastSendCode;
    private Boolean managerGranted;
    private Integer lastPingCode;
    private Integer watchVersion;
    private String probeError = "";
    private String communicationError = "";
    private final Map<String, Transfer> transfers = new HashMap<>();
    private final Map<String, PluginCall> snapshots = new HashMap<>();
    private final Map<String, Runnable> snapshotTimeouts = new HashMap<>();
    private final ArrayDeque<Outbound> outgoing = new ArrayDeque<>();
    private boolean sending;
    private WatchFrames frames;
    private int clipGeneration;
    private String watchBoot = "";
    private final String phoneSession = UUID.randomUUID().toString();
    private long stateRevision;
    private PluginCall activeClipCall;
    private Runnable clipTimeout;
    private final Set<File> frameDirectories = new HashSet<>();
    private final Set<File> retiredFrameDirectories = new HashSet<>();
    private static final class Outbound {
        final Message message;
        final Runnable delivered;
        final int generation;
        Outbound(Message message, Runnable delivered) { this(message, delivered, -1); }
        Outbound(Message message, Runnable delivered, int generation) { this.message = message; this.delivered = delivered; this.generation = generation; }
    }
    private final Receiver receiver = message -> {
        if (message.getData() != null) main.post(() -> receive(new String(message.getData(), StandardCharsets.UTF_8)));
    };
    private static class Transfer {
        long at = System.currentTimeMillis();
        String[] parts;
        Transfer(int n) { parts = new String[n]; }
    }
    @Override public void load() {
        RetiredWatchRestAlerts.clear(getContext());
        prefs = getContext().getSharedPreferences("opengym-huawei-watch", 0);
        String saved = prefs.getString("fingerprint", "");
        String migrated = WatchPeerIdentity.migrate(prefs.getString("package", ""), saved,
                BuildConfig.WATCH_BUNDLE, BuildConfig.WATCH_CERTIFICATE_SHA256, BuildConfig.WATCH_PEER_FINGERPRINT);
        if (!saved.equals(migrated) && !prefs.edit().putString("fingerprint", migrated).commit())
            communicationError = "Cannot migrate the saved watch identity";
        client = HiWear.getP2pClient(getActivity());
        frames = new WatchFrames(getContext(), main);
        File[] cached = getContext().getCacheDir().listFiles();
        if (cached != null) for (File dir : cached) if (dir.isDirectory() && dir.getName().matches("og-[a-f0-9]{32}")) deleteFrames(dir);
    }
    @PluginMethod public void configure(PluginCall call) {
        String pkg = call.getString("bundleName", "").trim(), fingerprint = call.getString("fingerprint", "").trim();
        if (!WatchPeerIdentity.valid(pkg, fingerprint)) {
            call.reject("Lite Wearable identity must be bundleName_Base64(P-256 public key), at most 127 characters"); return;
        }
        if (!pkg.equals(prefs.getString("package", "")) || !fingerprint.equals(prefs.getString("fingerprint", ""))) {
            prefs.edit().remove("authorized").commit();
        }
        if (!prefs.edit().putString("package", pkg).putString("fingerprint", fingerprint).commit()) { call.reject("Cannot save configuration"); return; }
        call.resolve();
    }
    @PluginMethod public void connect(PluginCall call) {
        try {
            android.os.Bundle metadata = getContext().getPackageManager().getApplicationInfo(getContext().getPackageName(), android.content.pm.PackageManager.GET_META_DATA).metaData;
            Object appId = metadata == null ? null : metadata.get("com.huawei.hms.client.appid");
            if (appId == null || appId.toString().isEmpty()) { call.reject("Rebuild with the Huawei APP ID registered for this Android package (-PhuaweiAppId=...)"); return; }
        } catch (Exception e) { call.reject("Cannot read Huawei application identity", e); return; }
        if (prefs.getString("package", "").isEmpty()) { call.reject("Configure the watch identity first"); return; }
        getActivity().runOnUiThread(() -> HiWear.getAuthClient(getActivity()).requestPermission(new AuthCallback() {
            @Override public void onOk(Permission[] granted) { main.post(() -> { prefs.edit().putBoolean("authorized", true).commit(); discover(call); }); }
            @Override public void onCancel() { call.reject("Wear Engine authorization cancelled"); }
        }, Permission.DEVICE_MANAGER).addOnFailureListener(e -> call.reject("Wear Engine authorization failed: " + e.getMessage())));
    }
    private void discover(PluginCall call) {
        refreshing = true; lastDiscovery = System.currentTimeMillis();
        lastPingCode = null; watchVersion = null; probeError = "";
        HiWear.getAuthClient(getActivity()).checkPermission(Permission.DEVICE_MANAGER)
                .addOnSuccessListener(granted -> main.post(() -> {
                    managerGranted = Boolean.TRUE.equals(granted);
                    if (!managerGranted) {
                        prefs.edit().putBoolean("authorized", false).commit();
                        discoveryFailed(call, new Exception("Wear Engine DEVICE_MANAGER permission is not granted"));
                        return;
                    }
                    discoverAuthorized(call);
                })).addOnFailureListener(e -> main.post(() -> {
                    managerGranted = null;
                    discoveryFailed(call, new Exception("Wear Engine permission check failed: " + e.getMessage(), e));
                }));
    }
    private void discoverAuthorized(PluginCall call) {
        HiWear.getDeviceClient(getActivity()).getBondedDevices().addOnSuccessListener(devices -> main.post(() -> {
            ArrayList<Device> connected = new ArrayList<>();
            ArrayList<String> uuids = new ArrayList<>();
            ArrayList<Integer> caps = new ArrayList<>();
            for (Device d : devices) {
                if (d != null && d.isConnected()) {
                    connected.add(d);
                    uuids.add(d.getUuid() == null ? "" : d.getUuid());
                    caps.add(d.getP2pCapability());
                }
            }
            int picked = WatchPeerIdentity.selectConnectedIndex(uuids, caps, prefs.getString("lastDeviceUuid", ""));
            if (picked < 0) { discoveryFailed(call, new Exception("Connect a compatible watch in Huawei Health, then retry")); return; }
            boolean replaceReceiver = receiverRegistered;
            receiverRegistered = false; device = connected.get(picked); installed = false;
            Runnable register = () -> {
                client.setPeerPkgName(prefs.getString("package", ""));
                client.setPeerFingerPrint(prefs.getString("fingerprint", ""));
                client.registerReceiver(device, receiver).addOnSuccessListener(v -> main.post(() -> {
                    // A connected receiver is retained while waiting for the watch's hello.
                    refreshing = false; receiverRegistered = true; communicationError = "";
                    lastHelloRequest = 0; requestHello();
                    if (call != null) call.resolve(link()); notifyListeners("watchState", link());
                    probeWatch();
                })).addOnFailureListener(e -> main.post(() -> discoveryFailed(call, e)));
            };
            // Await teardown: an asynchronous unregister can otherwise remove the new receiver.
            if (replaceReceiver) client.unregisterReceiver(receiver).addOnSuccessListener(v -> main.post(register))
                    .addOnFailureListener(e -> main.post(() -> discoveryFailed(call, e)));
            else register.run();
        })).addOnFailureListener(e -> main.post(() -> discoveryFailed(call, e)));
    }
    private void probeWatch() {
        if (device == null) return;
        lastPingCode = null; probeError = "";
        try {
            client.ping(device, code -> main.post(() -> {
                lastPingCode = code; notifyListeners("watchState", link());
            })).addOnFailureListener(e -> main.post(() -> {
                probeError = String.valueOf(e.getMessage()); notifyListeners("watchState", link());
            }));
            client.getAppVersion(device, prefs.getString("package", "")).addOnSuccessListener(version -> main.post(() -> {
                watchVersion = version; notifyListeners("watchState", link());
            })).addOnFailureListener(e -> main.post(() -> {
                probeError = "App version: " + e.getMessage(); notifyListeners("watchState", link());
            }));
        } catch (Exception e) { probeError = String.valueOf(e.getMessage()); }
    }
    private void discoveryFailed(PluginCall call, Exception e) {
        refreshing = false; device = null; installed = false; receiverRegistered = false;
        communicationError = String.valueOf(e.getMessage());
        if (call != null) call.reject(e.getMessage());
        notifyListeners("watchState", link());
    }
    private JSObject link() {
        JSObject out = new JSObject();
        out.put("paired", device != null && device.isConnected()); out.put("installed", installed);
        out.put("receiverRegistered", receiverRegistered); out.put("receivedPackets", receivedPackets);
        out.put("lastSendCode", lastSendCode == null ? JSONObject.NULL : lastSendCode);
        out.put("managerGranted", managerGranted == null ? JSONObject.NULL : managerGranted);
        out.put("lastPingCode", lastPingCode == null ? JSONObject.NULL : lastPingCode);
        out.put("watchVersion", watchVersion == null ? JSONObject.NULL : watchVersion);
        out.put("probeError", probeError);
        out.put("watchBoot", watchBoot);
        if (device != null) { out.put("deviceName", device.getName()); out.put("p2pCapability", device.getP2pCapability()); }
        out.put("communicationError", communicationError);
        out.put("activated", !refreshing); out.put("configured", !prefs.getString("package", "").isEmpty());
        out.put("bundleName", prefs.getString("package", "")); out.put("fingerprint", prefs.getString("fingerprint", ""));
        out.put("transport", "huawei"); return out;
    }
    @PluginMethod public void status(PluginCall call) { main.post(() -> {
        if (!refreshing && prefs.getBoolean("authorized", false) && !prefs.getString("package", "").isEmpty()
                && (device == null || !device.isConnected() || !receiverRegistered) && System.currentTimeMillis() - lastDiscovery > 10000) discover(null);
        if (!refreshing && receiverRegistered && !installed) requestHello();
        call.resolve(link());
    }); }
    private void requestHello() {
        if (device == null || !device.isConnected() || System.currentTimeMillis() - lastHelloRequest < 15000) return;
        lastHelloRequest = System.currentTimeMillis();
        try { enqueue(new JSONObject().put("kind", "helloRequest"), UUID.randomUUID().toString()); }
        catch (Exception e) { communicationError = String.valueOf(e.getMessage()); }
    }
    private JSONArray events() throws JSONException { return new JSONArray(prefs.getString("events", "[]")); }
    @PluginMethod public void drain(PluginCall call) {
        main.post(() -> { try { JSObject out = new JSObject(); out.put("events", events()); call.resolve(out); }
        catch (Exception e) { call.reject("Cannot read durable event queue", e); } });
    }
    @PluginMethod public void ack(PluginCall call) {
        main.post(() -> {
            try {
                JSArray ids = call.getArray("ids", new JSArray()); JSONArray old = events(), keep = new JSONArray();
                Set<String> done = new HashSet<>(); for (int i = 0; i < ids.length(); i++) done.add(ids.getString(i));
                for (int i = 0; i < old.length(); i++) if (!done.contains(old.getJSONObject(i).getString("id"))) keep.put(old.get(i));
                if (!prefs.edit().putString("events", keep.toString()).commit()) throw new Exception("Cannot persist queue");
                enqueue(new JSONObject().put("kind", "eventAck").put("ids", ids), UUID.randomUUID().toString()); call.resolve();
            } catch (Exception e) { call.reject("Cannot acknowledge events", e); }
        });
    }
    @PluginMethod public void sendSnapshot(PluginCall call) {
        main.post(() -> {
            if (device == null || !installed) { call.reject("Open openGym on the connected watch"); return; }
            String id = UUID.randomUUID().toString();
            try {
                JSONObject snapshot = new JSONObject(call.getString("json", ""));
                snapshots.put(id, call);
                Runnable timeout = () -> {
                    snapshotTimeouts.remove(id);
                    PluginCall pending = snapshots.remove(id);
                    if (pending != null) pending.reject("Watch snapshot acknowledgement timed out");
                };
                snapshotTimeouts.put(id, timeout);
                main.postDelayed(timeout, 60000);
                enqueue(stamped(new JSONObject().put("kind", "snapshot").put("snapshot", snapshot)), id, true);
            } catch (Exception e) {
                Runnable timeout = snapshotTimeouts.remove(id);
                if (timeout != null) main.removeCallbacks(timeout);
                snapshots.remove(id);
                call.reject("Cannot send snapshot", e);
            }
        });
    }
    private void resolveClipCall(PluginCall call, JSObject result) {
        if (call != null && activeClipCall == call) {
            activeClipCall = null;
            if (clipTimeout != null) { main.removeCallbacks(clipTimeout); clipTimeout = null; }
            call.resolve(result);
        }
    }
    private void rejectClipCall(PluginCall call, String message, Exception e) {
        if (call != null && activeClipCall == call) {
            activeClipCall = null;
            if (clipTimeout != null) { main.removeCallbacks(clipTimeout); clipTimeout = null; }
            if (e != null) call.reject(message, e);
            else call.reject(message);
        }
    }
    @PluginMethod public void sendClips(PluginCall call) {
        main.post(() -> {
            if (device == null || !installed) { call.reject("Watch not connected"); return; }
            if (activeClipCall != null) rejectClipCall(activeClipCall, "Animation transfer replaced", null);
            activeClipCall = call;
            int generation = ++clipGeneration;
            clipTimeout = () -> {
                if (activeClipCall == call) {
                    clipGeneration++;
                    rejectClipCall(call, "Animation transfer timed out", null);
                }
            };
            main.postDelayed(clipTimeout, 180000);
            try {
                JSArray clips = call.getArray("clips", new JSArray());
                if (call.getString("wid", "").isEmpty()) { rejectClipCall(call, "Built-in animation asset required", null); return; }
                sendClipAt(call, clips, 0, generation);
            } catch (Exception e) { rejectClipCall(call, "Invalid animation request", e); }
        });
    }
    private void advanceClip(PluginCall call, JSArray clips, int nextIndex, int generation) {
        try { sendClipAt(call, clips, nextIndex, generation); }
        catch (Exception e) { rejectClipCall(call, "Cannot transfer animation", e); }
    }
    private void sendClipAt(PluginCall call, JSArray clips, int index, int generation) throws JSONException {
        if (generation != clipGeneration || activeClipCall != call) { rejectClipCall(call, "Animation transfer cancelled", null); return; }
        if (index >= clips.length()) { JSObject out = new JSObject(); out.put("sent", true); resolveClipCall(call, out); return; }
        JSONObject clip = clips.optJSONObject(index);
        String wid = call.getString("wid", "");
        String exId = clip == null ? "" : clip.optString("exId", ""), path = clip == null ? "" : clip.optString("path", "");
        if (exId.isEmpty() || path.isEmpty()) { sendClipAt(call, clips, index + 1, generation); return; }
        String token = "og-" + UUID.randomUUID().toString().replace("-", "");
        File directory = new File(getContext().getCacheDir(), token);
        frameDirectories.add(directory);
        frames.render(path, directory, () -> generation != clipGeneration || activeClipCall != call, files -> {
            if (generation != clipGeneration || activeClipCall != call) { deleteFrames(directory); return; }
            if (files.isEmpty()) { deleteFrames(directory); advanceClip(call, clips, index + 1, generation); return; }
            try {
                JSONArray names = new JSONArray(); for (File file : files) names.put(file.getName());
                enqueue(new JSONObject().put("kind", "clip").put("wid", wid).put("exId", exId).put("files", names).put("interval", 250), token);
                for (int i = 0; i < files.size(); i++) {
                    final boolean last = i == files.size() - 1;
                    outgoing.add(new Outbound(new Message.Builder().setPayload(files.get(i)).build(), () -> {
                        if (generation != clipGeneration || activeClipCall != call) return;
                        if (!last) return;
                        deleteFrames(directory);
                        advanceClip(call, clips, index + 1, generation);
                    }, generation));
                }
                pump();
            } catch (Exception e) {
                deleteFrames(directory);
                if (generation == clipGeneration && activeClipCall == call) advanceClip(call, clips, index + 1, generation);
            }
        }, e -> {
            deleteFrames(directory);
            if (generation == clipGeneration && activeClipCall == call) advanceClip(call, clips, index + 1, generation);
        });
    }
    private void deleteFrames(File directory) {
        File[] files = directory.listFiles(); if (files != null) for (File f : files) f.delete(); directory.delete(); frameDirectories.remove(directory); retiredFrameDirectories.remove(directory);
    }
    private void cancelClips() {
        clipGeneration++;
        retiredFrameDirectories.addAll(frameDirectories);
        WatchSendQueue.removePending(outgoing, packet -> packet.generation >= 0, sending);
        rejectClipCall(activeClipCall, "Animation transfer cancelled", null);
        if (!sending || outgoing.isEmpty() || outgoing.peek().generation < 0)
            for (File dir : new ArrayList<>(retiredFrameDirectories)) deleteFrames(dir);
    }
    @PluginMethod public void dropClips(PluginCall call) { main.post(() -> { cancelClips(); call.resolve(); }); }
    @PluginMethod public void endWorkout(PluginCall call) {
        main.post(() -> {
            if (device == null || !installed) { call.reject("Watch not connected"); return; }
            try {
                cancelClips();
                enqueue(stamped(new JSONObject().put("kind", "workoutEnd").put("wid", call.getString("wid", ""))
                        .put("discard", call.getBoolean("discard", false))), UUID.randomUUID().toString(), true);
                JSObject out = new JSObject(); out.put("queued", true); call.resolve(out);
            } catch (Exception e) { call.reject("Cannot end watch workout", e); }
        });
    }
    @PluginMethod public void openOnWatch(PluginCall call) {
        main.post(() -> {
            if (prefs.getString("package", "").isEmpty() || device == null || !device.isConnected() || !receiverRegistered) {
                call.reject("Watch not connected"); return;
            }
            try {
                client.ping(device, code -> main.post(() -> {
                    lastPingCode = code; notifyListeners("watchState", link());
                    if (code != 201 && code != 202) { call.reject("Cannot open watch app: " + code); return; }
                    if (code == 202) {
                        lastHelloRequest = 0; requestHello();
                    } else {
                        main.postDelayed(() -> {
                            if (device != null && device.isConnected() && receiverRegistered) {
                                lastHelloRequest = 0; requestHello();
                            }
                        }, 1200);
                    }
                    JSObject result = new JSObject(); result.put("requested", true); result.put("code", code); call.resolve(result);
                })).addOnFailureListener(e -> main.post(() -> call.reject("Cannot open watch app", e)));
            } catch (Exception e) { call.reject("Cannot open watch app", e); }
        });
    }
    @PluginMethod public void sendRest(PluginCall call) {
        main.post(() -> {
            if (device == null || !installed) { call.reject("Watch not connected"); return; }
            try {
                JSONObject body = new JSONObject().put("kind", "restState").put("wid", call.getString("wid", ""))
                        .put("rest", call.getObject("rest") == null ? JSONObject.NULL : call.getObject("rest"));
                long restAt = call.getData() == null ? 0L : call.getData().optLong("restAt", 0L);
                if (restAt > 0L) body.put("restAt", restAt);
                JSONObject payload = stamped(body);
                enqueue(payload, UUID.randomUUID().toString(), true);
                JSObject out = new JSObject(); out.put("queued", true); call.resolve(out);
            } catch (Exception e) { call.reject("Cannot send rest state", e); }
        });
    }
    private JSONObject stamped(JSONObject payload) throws JSONException {
        return payload.put("session", phoneSession).put("rev", ++stateRevision);
    }
    private void enqueue(JSONObject payload, String id) throws JSONException { enqueue(payload, id, false); }
    private void enqueue(JSONObject payload, String id, boolean priority) throws JSONException {
        String text = Uri.encode(payload.toString(), "!'()*-._~");
        int n = (text.length() + 599) / 600;
        List<Outbound> packets = new ArrayList<>();
        for (int i = 0; i < n; i++) packets.add(new Outbound(new Message.Builder().setPayload(new JSONObject().put("v", 1).put("id", id).put("i", i).put("n", n)
                .put("data", text.substring(i * 600, Math.min(text.length(), (i + 1) * 600))).toString().getBytes(StandardCharsets.UTF_8)).build(), null, payload.optString("kind").equals("clip") ? clipGeneration : -1));
        if (priority) WatchSendQueue.prioritize(outgoing, packets, sending); else outgoing.addAll(packets);
        pump();
    }
    private void pump() {
        if (sending || outgoing.isEmpty() || device == null) return;
        sending = true;
        Outbound packet = outgoing.peek();
        Message message = packet.message;
        final boolean[] settled = {false};
        final Runnable[] sendTimeoutRef = new Runnable[1];
        java.util.function.Consumer<Boolean> end = ok -> main.post(() -> {
            if (settled[0]) return; settled[0] = true; sending = false;
            if (sendTimeoutRef[0] != null) main.removeCallbacks(sendTimeoutRef[0]);
            if (ok) {
                outgoing.poll();
                if (packet.generation >= 0 && packet.generation != clipGeneration) { for (File dir : new ArrayList<>(retiredFrameDirectories)) deleteFrames(dir); }
                else if (packet.delivered != null) packet.delivered.run();
                pump();
            } else {
                outgoing.clear();
                for (File dir : new ArrayList<>(frameDirectories)) deleteFrames(dir);
                if (activeClipCall != null) { clipGeneration++; rejectClipCall(activeClipCall, "Animation transport interrupted", null); }
                for (Map.Entry<String, PluginCall> entry : new ArrayList<>(snapshots.entrySet())) {
                    Runnable t = snapshotTimeouts.remove(entry.getKey());
                    if (t != null) main.removeCallbacks(t);
                    entry.getValue().reject("Watch connection interrupted");
                }
                snapshots.clear();
                installed = false;
                notifyListeners("watchState", link());
            }
        });
        sendTimeoutRef[0] = () -> { if (!settled[0]) { communicationError = "Wear Engine send timed out"; end.accept(false); } };
        main.postDelayed(sendTimeoutRef[0], 10000);
        client.send(device, message, new SendCallback() {
            @Override public void onSendResult(int code) { main.post(() -> {
                if (settled[0]) return;
                lastSendCode = code;
                boolean ok = code == com.huawei.wearengine.common.WearEngineErrorCode.ERROR_CODE_COMM_SUCCESS;
                communicationError = ok ? "" : "Wear Engine send failed: " + code;
                end.accept(ok);
            }); }
            @Override public void onSendProgress(long count) {}
        }).addOnFailureListener(e -> main.post(() -> { if (!settled[0]) { communicationError = String.valueOf(e.getMessage()); end.accept(false); } }));
    }
    private void receive(String raw) {
        receivedPackets++;
        try {
            long now = System.currentTimeMillis();
            transfers.entrySet().removeIf(e -> now - e.getValue().at > 60000);
            JSONObject p = new JSONObject(raw);
            int n = p.getInt("n"), i = p.getInt("i"); String id = p.getString("id"), data = p.getString("data");
            if (p.getInt("v") != 1 || n < 1 || n > 1024 || i < 0 || i >= n || id.length() > 100 || data.length() > 600) return;
            Transfer t = transfers.get(id);
            if (t == null) { if (transfers.size() >= 4) return; t = new Transfer(n); transfers.put(id, t); }
            if (t.parts.length != n) return;
            t.parts[i] = data;
            StringBuilder text = new StringBuilder();
            for (String part : t.parts) { if (part == null) return; text.append(part); }
            transfers.remove(id);
            JSONObject payload = new JSONObject(Uri.decode(text.toString()));
            String kind = payload.getString("kind");
            if (kind.equals("hello")) {
                boolean was = installed; installed = true;
                if (device != null && device.getUuid() != null && !device.getUuid().isEmpty()) {
                    prefs.edit().putString("lastDeviceUuid", device.getUuid()).apply();
                }
                String boot = payload.optString("boot", ""); boolean restarted = !boot.equals(watchBoot); watchBoot = boot;
                if (!was || restarted) notifyListeners("watchState", link());
            } else if (kind.equals("snapshotAck")) {
                String ackId = payload.getString("id");
                Runnable timeout = snapshotTimeouts.remove(ackId);
                if (timeout != null) main.removeCallbacks(timeout);
                PluginCall call = snapshots.remove(ackId);
                if (call != null) { JSObject out = new JSObject(); out.put("sent", true); call.resolve(out); }
            } else if (kind.equals("events")) {
                JSONArray queue = events(), incoming = payload.getJSONArray("events");
                Set<String> seen = new HashSet<>();
                for (int j = 0; j < queue.length(); j++) seen.add(queue.getJSONObject(j).getString("id"));
                for (int j = 0; j < incoming.length(); j++) {
                    JSONObject ev = incoming.getJSONObject(j);
                    String evId = ev.optString("id", ""), evType = ev.optString("type", "");
                    if (!evId.isEmpty() && !evType.isEmpty() && seen.add(evId)) queue.put(ev);
                }
                while (queue.length() > MAX_EVENTS) queue.remove(0);
                if (!prefs.edit().putString("events", queue.toString()).commit()) throw new Exception("Cannot persist watch events");
                notifyListeners("watchEvent", new JSObject());
            }
        } catch (Exception e) { JSObject error = new JSObject(); error.put("error", e.getMessage()); notifyListeners("watchError", error); }
    }
    @Override protected void handleOnDestroy() {
        clipGeneration++;
        rejectClipCall(activeClipCall, "Watch bridge closed", null);
        if (frames != null) frames.close();
        if (client != null) client.unregisterReceiver(receiver);
        main.removeCallbacksAndMessages(null);
        snapshotTimeouts.clear();
        for (PluginCall call : snapshots.values()) call.reject("Watch bridge closed");
        snapshots.clear(); super.handleOnDestroy();
    }
}
