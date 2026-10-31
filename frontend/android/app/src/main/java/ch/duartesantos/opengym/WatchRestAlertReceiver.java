package ch.duartesantos.opengym;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Handler;
import android.os.Looper;
import android.os.PowerManager;
import com.huawei.wearengine.HiWear;
import com.huawei.wearengine.device.Device;
import java.util.concurrent.atomic.AtomicBoolean;

/** Android wakes the phone at the deadline, then sends to the same paired watch only. */
public final class WatchRestAlertReceiver extends BroadcastReceiver {
    @Override public void onReceive(Context context, Intent intent) {
        if (intent == null) return;
        Context ctx = context.getApplicationContext(); String token = intent.getStringExtra("token");
        if (token == null || !WatchRestAlerts.claim(ctx, token)) return;
        PendingResult pending = goAsync(); Handler handler = new Handler(Looper.getMainLooper());
        AtomicBoolean finished = new AtomicBoolean();
        PowerManager.WakeLock cpu = wakeLock(ctx);
        Runnable done = () -> { if (finished.compareAndSet(false, true)) { if (cpu != null && cpu.isHeld()) cpu.release(); pending.finish(); } };
        handler.postDelayed(() -> { if (!finished.get()) WatchRestAlerts.error(ctx, "Watch notification timed out"); done.run(); }, 9000);
        try {
            HiWear.getDeviceClient(ctx).getBondedDevices().addOnSuccessListener(devices -> {
                if (finished.get() || !WatchRestAlerts.current(ctx, token)) { done.run(); return; }
                SharedPreferences p = WatchRestAlerts.prefs(ctx);
                for (Device device : devices) {
                    if (!p.getString("uuid", "").equals(device.getUuid())) continue;
                    try {
                        WatchRestAlerts.send(ctx, device, p.getString("package", ""), done, e -> {
                            WatchRestAlerts.error(ctx, e.getMessage()); done.run();
                        });
                    } catch (Exception e) { WatchRestAlerts.error(ctx, e.getMessage()); done.run(); }
                    return;
                }
                WatchRestAlerts.error(ctx, "The scheduled watch is unavailable"); done.run();
            }).addOnFailureListener(e -> { WatchRestAlerts.error(ctx, e.getMessage()); done.run(); });
        } catch (Exception e) { WatchRestAlerts.error(ctx, e.getMessage()); done.run(); }
    }
    private static PowerManager.WakeLock wakeLock(Context ctx) {
        try {
            PowerManager.WakeLock cpu = ((PowerManager) ctx.getSystemService(Context.POWER_SERVICE))
                    .newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "opengym:watch-rest");
            cpu.acquire(10000); return cpu;
        } catch (RuntimeException e) { return null; }
    }
}
