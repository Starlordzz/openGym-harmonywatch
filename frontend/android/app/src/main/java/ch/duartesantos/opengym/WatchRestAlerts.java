package ch.duartesantos.opengym;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import com.huawei.wearengine.HiWear;
import com.huawei.wearengine.device.Device;
import com.huawei.wearengine.notify.Action;
import com.huawei.wearengine.notify.Notification;
import com.huawei.wearengine.notify.NotificationTemplate;
import org.json.JSONObject;
import java.util.UUID;
import java.util.function.Consumer;

/** Opt-in phone alarm -> Wear Engine system notification, independent of the WebView timer. */
final class WatchRestAlerts {
    private static final int ID = 7301;
    private static final int FLAGS = PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE;
    private WatchRestAlerts() {}

    static SharedPreferences prefs(Context ctx) { return ctx.getSharedPreferences("opengym-watch-rest", Context.MODE_PRIVATE); }
    static boolean enabled(Context ctx) { return prefs(ctx).getBoolean("enabled", false); }
    static void error(Context ctx, String message) { prefs(ctx).edit().putString("error", message).commit(); }
    static synchronized void enable(Context ctx, boolean on) {
        prefs(ctx).edit().putBoolean("enabled", on).putString("error", "").commit();
        if (!on) cancel(ctx);
    }
    static synchronized void boot(Context ctx, String value) {
        if (value.isEmpty() || value.equals(prefs(ctx).getString("boot", ""))) return;
        cancel(ctx);
        prefs(ctx).edit().putString("boot", value).putLong("rev", -1).commit();
    }
    private static PendingIntent pending(Context ctx, String token) {
        return PendingIntent.getBroadcast(ctx, ID, new Intent(ctx, WatchRestAlertReceiver.class).putExtra("token", token), FLAGS);
    }
    private static AlarmManager alarms(Context ctx) { return (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE); }
    private static void cancel(Context ctx) {
        PendingIntent pi = pending(ctx, ""); alarms(ctx).cancel(pi); pi.cancel();
        prefs(ctx).edit().putString("token", "").putString("key", "").putLong("at", 0).commit();
    }
    static synchronized void receive(Context ctx, JSONObject message, Device device, String pkg) throws Exception {
        if (!enabled(ctx) || device == null) return;
        SharedPreferences p = prefs(ctx);
        String boot = message.getString("boot"); long rev = message.getLong("rev"), at = message.getLong("at");
        int decision = WatchRestPlan.decide(p.getString("boot", ""), p.getLong("rev", -1), p.getString("key", ""),
                boot, rev, at, message.getBoolean("enabled"), System.currentTimeMillis());
        if (decision == WatchRestPlan.IGNORE) return;
        p.edit().putLong("rev", rev).commit();
        if (decision == WatchRestPlan.CANCEL) { cancel(ctx); return; }
        if (decision == WatchRestPlan.KEEP) return;
        String uuid = device.getUuid();
        if (uuid == null || uuid.isEmpty()) throw new Exception("Cannot identify the watch for rest notifications");
        String token = UUID.randomUUID().toString();
        if (!p.edit().putString("key", boot + ":" + at).putString("token", token).putString("uuid", uuid)
                .putString("package", pkg).putLong("at", at).putBoolean("fired", false).putString("error", "").commit()) {
            throw new Exception("Cannot persist watch rest alarm");
        }
        PendingIntent pi = pending(ctx, token); AlarmManager am = alarms(ctx); am.cancel(pi);
        try {
            try {
                if (Build.VERSION.SDK_INT < 31 || am.canScheduleExactAlarms()) am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi);
                else am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi);
            } catch (SecurityException e) { am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi); }
        } catch (RuntimeException e) { cancel(ctx); error(ctx, e.getMessage()); throw e; }
    }
    static synchronized boolean current(Context ctx, String token) {
        SharedPreferences p = prefs(ctx);
        return enabled(ctx) && !token.isEmpty() && token.equals(p.getString("token", ""));
    }
    static synchronized boolean claim(Context ctx, String token) {
        SharedPreferences p = prefs(ctx);
        if (!current(ctx, token) || p.getBoolean("fired", false)) return false;
        long at = p.getLong("at", 0), now = System.currentTimeMillis();
        if (!WatchRestPlan.due(at, now)) {
            if (now > at) error(ctx, "Rest reminder was delayed; allow exact alarms and check battery settings");
            return false;
        }
        return p.edit().putBoolean("fired", true).commit();
    }
    static void send(Context ctx, Device device, String pkg, Runnable success, Consumer<Exception> failure) {
        if (!device.isConnected()) { failure.accept(new Exception("Watch disconnected")); return; }
        if (device.getNotifyCapability() == Device.DEVICE_CAPABILITY_NOT_SUPPORT) { failure.accept(new Exception("This watch does not support template notifications")); return; }
        Notification notification = new Notification.Builder().setTemplateId(NotificationTemplate.NOTIFICATION_TEMPLATE_NO_BUTTON)
                .setPackageName(pkg).setTitle("openGym").setText(ctx.getString(R.string.watch_rest_over))
                .setAction(new Action() {
                    @Override public void onResult(Notification n, int feedback) {}
                    @Override public void onError(Notification n, int code, String text) { error(ctx, "Wear Engine notification error " + code); }
                }).build();
        HiWear.getNotifyClient(ctx).notify(device, notification).addOnSuccessListener(v -> {
            error(ctx, ""); success.run();
        }).addOnFailureListener(failure::accept);
    }
}
