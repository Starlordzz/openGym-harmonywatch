package ch.duartesantos.opengym;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;

/** Cancels the removed FIT notification alarm on upgrade and first launch. */
final class RetiredWatchRestAlerts {
    static synchronized void clear(Context context) {
        SharedPreferences prefs = context.getSharedPreferences("opengym-watch-rest", Context.MODE_PRIVATE);
        if (prefs.getBoolean("retired", false)) return;
        Intent old = new Intent().setClassName(context.getPackageName(), "ch.duartesantos.opengym.WatchRestAlertReceiver");
        PendingIntent alarm = PendingIntent.getBroadcast(context, 7301, old, PendingIntent.FLAG_NO_CREATE | PendingIntent.FLAG_IMMUTABLE);
        if (alarm != null) {
            ((AlarmManager) context.getSystemService(Context.ALARM_SERVICE)).cancel(alarm);
            alarm.cancel();
        }
        prefs.edit().clear().putBoolean("retired", true).commit();
    }
}
