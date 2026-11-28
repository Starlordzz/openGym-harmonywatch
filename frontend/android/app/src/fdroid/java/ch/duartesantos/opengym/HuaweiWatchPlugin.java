package ch.duartesantos.opengym;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * The Huawei Watch link in the F-Droid and offline builds: disabled. Huawei Wear Engine is a
 * closed-source proprietary SDK, so open-source F-Droid builds exclude it while preserving the
 * same Capacitor plugin surface.
 */
@CapacitorPlugin(name = "HuaweiWatch")
public class HuaweiWatchPlugin extends Plugin {

    @PluginMethod
    public void configure(PluginCall call) { call.reject("Huawei Wear Engine is not included in this build"); }

    @PluginMethod
    public void connect(PluginCall call) { call.reject("Huawei Wear Engine is not included in this build"); }

    @PluginMethod
    public void status(PluginCall call) {
        JSObject out = new JSObject();
        out.put("supported", false);
        out.put("activated", false);
        out.put("paired", false);
        out.put("installed", false);
        out.put("reachable", false);
        out.put("configured", false);
        out.put("transport", "huawei");
        call.resolve(out);
    }

    @PluginMethod
    public void drain(PluginCall call) { call.resolve(new JSObject().put("events", new JSArray())); }

    @PluginMethod
    public void ack(PluginCall call) { call.resolve(); }

    @PluginMethod
    public void sendSnapshot(PluginCall call) { call.resolve(new JSObject().put("sent", false)); }

    @PluginMethod
    public void sendClips(PluginCall call) { call.resolve(new JSObject().put("sent", 0)); }

    @PluginMethod
    public void dropClips(PluginCall call) { call.resolve(); }

    @PluginMethod
    public void endWorkout(PluginCall call) { call.resolve(new JSObject().put("queued", false)); }

    @PluginMethod
    public void openOnWatch(PluginCall call) { call.resolve(new JSObject().put("ok", false)); }

    @PluginMethod
    public void sendRest(PluginCall call) { call.resolve(new JSObject().put("queued", false)); }
}
