package com.studyhard.app;

import android.annotation.SuppressLint;
import android.app.AlarmManager;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.media.AudioAttributes;
import android.net.Uri;
import android.os.Build;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Phone reminders planned by the web app (src/core/reminders.ts): learning time, reward ready
 * and the parents' backup reminder. The plan (a JSON list of notes with their times) is stored here,
 * each future note gets an alarm, and ReminderReceiver shows it when the alarm goes off.
 * Alarms are inexact (no special permission), and come back after a restart or an update.
 */
final class Reminders {

    static final String PREFS = "studyhard_reminders";
    static final String KEY_PLAN = "plan";
    static final String KEY_IDS = "ids";
    static final String KEY_SNOOZE = "backupSnoozeUntil";
    /** v2: with MN's own sound ("Chime Pop", res/raw/mn_chime). A channel's sound is fixed once made. */
    static final String CH_DAILY = "learning_time_v3";
    static final String CH_READY = "reward_ready_v3";
    static final String CH_BACKUP = "backup_v2";
    static final String ACTION_FIRE = "com.studyhard.app.REMINDER";
    static final String ACTION_LATER = "com.studyhard.app.BACKUP_LATER";
    /** Extra on the intent that opens the app from a note: "play" or "backup". */
    static final String EXTRA_OPEN = "mn_open";
    static final long DAY = 86_400_000L;

    private Reminders() {}

    static SharedPreferences prefs(Context ctx) {
        return ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    static int immutable() {
        return Build.VERSION.SDK_INT >= 23 ? PendingIntent.FLAG_IMMUTABLE : 0;
    }

    /** Keep a new plan and schedule every note in it that is still ahead. */
    static void apply(Context ctx, String planJson) {
        prefs(ctx).edit().putString(KEY_PLAN, planJson).apply();
        schedule(ctx);
    }

    static PendingIntent firePending(Context ctx, int id, String item) {
        Intent i = new Intent(ctx, ReminderReceiver.class).setAction(ACTION_FIRE);
        i.putExtra("id", id);
        if (item != null) i.putExtra("item", item);
        return PendingIntent.getBroadcast(ctx, 7000 + id, i, PendingIntent.FLAG_UPDATE_CURRENT | immutable());
    }

    /** Cancel the alarms set before, then set one for each note still ahead in the plan. */
    static void schedule(Context ctx) {
        AlarmManager am = (AlarmManager) ctx.getSystemService(Context.ALARM_SERVICE);
        if (am == null) return;
        SharedPreferences p = prefs(ctx);
        for (String s : p.getString(KEY_IDS, "").split(",")) {
            if (s.isEmpty()) continue;
            try {
                PendingIntent old = firePending(ctx, Integer.parseInt(s), null);
                am.cancel(old);
                old.cancel();
            } catch (Exception ignored) {
                // A stale id: nothing to cancel.
            }
        }
        StringBuilder ids = new StringBuilder();
        long now = System.currentTimeMillis();
        long snooze = p.getLong(KEY_SNOOZE, 0);
        try {
            JSONObject plan = new JSONObject(p.getString(KEY_PLAN, "{}"));
            JSONArray items = plan.optJSONArray("items");
            for (int i = 0; items != null && i < items.length(); i++) {
                JSONObject it = items.getJSONObject(i);
                long at = it.optLong("at");
                if (at <= now) continue;
                if ("backup".equals(it.optString("kind")) && at < snooze) continue;
                int id = it.optInt("id");
                PendingIntent pi = firePending(ctx, id, it.toString());
                if (Build.VERSION.SDK_INT >= 23) am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi);
                else am.set(AlarmManager.RTC_WAKEUP, at, pi);
                if (ids.length() > 0) ids.append(',');
                ids.append(id);
            }
        } catch (Exception ignored) {
            // A broken plan: nothing scheduled until the app sends a new one.
        }
        p.edit().putString(KEY_IDS, ids.toString()).apply();
    }

    static void createChannels(Context ctx) {
        if (Build.VERSION.SDK_INT < 26) return;
        NotificationManager nm = ctx.getSystemService(NotificationManager.class);
        if (nm == null) return;
        // Older channels: the first had the phone's default sound; v2 had the jar notes.
        nm.deleteNotificationChannel("melt_watch");
        nm.deleteNotificationChannel("backup");
        nm.deleteNotificationChannel("melt_watch_v2");
        AudioAttributes attrs = new AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_NOTIFICATION)
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .build();
        // Learning time and reward ready pop up on the screen (high importance), with MN's chime.
        NotificationChannel daily = new NotificationChannel(CH_DAILY, "Learning time", NotificationManager.IMPORTANCE_HIGH);
        daily.setSound(chime(ctx), attrs);
        daily.setDescription("One note a day at the time you chose in MN");
        NotificationChannel ready = new NotificationChannel(CH_READY, "Reward ready", NotificationManager.IMPORTANCE_HIGH);
        ready.setSound(chime(ctx), attrs);
        ready.setDescription("When a child's jar is full and the reward is waiting to be given");
        NotificationChannel backup = new NotificationChannel(CH_BACKUP, "Backup reminders", NotificationManager.IMPORTANCE_DEFAULT);
        backup.setSound(chime(ctx), attrs);
        backup.setDescription("For parents: save a backup so progress is never lost");
        nm.createNotificationChannel(daily);
        nm.createNotificationChannel(ready);
        nm.createNotificationChannel(backup);
    }

    /** MN's notification sound. */
    static Uri chime(Context ctx) {
        return Uri.parse("android.resource://" + ctx.getPackageName() + "/" + R.raw.mn_chime);
    }

    static boolean allowed(Context ctx) {
        if (Build.VERSION.SDK_INT >= 33 && ctx.checkSelfPermission("android.permission.POST_NOTIFICATIONS") != PackageManager.PERMISSION_GRANTED) return false;
        return NotificationManagerCompat.from(ctx).areNotificationsEnabled();
    }

    /** Opens the app; "backup" goes to the grown-ups' backup screen. */
    static PendingIntent openApp(Context ctx, String open, int code) {
        Intent i = new Intent(ctx, MainActivity.class)
            .setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP)
            .putExtra(EXTRA_OPEN, open);
        return PendingIntent.getActivity(ctx, code, i, PendingIntent.FLAG_UPDATE_CURRENT | immutable());
    }

    @SuppressLint("MissingPermission")
    static void show(Context ctx, JSONObject it) {
        createChannels(ctx);
        if (!allowed(ctx)) return;
        String kind = it.optString("kind");
        boolean backup = "backup".equals(kind);
        boolean ready = "ready".equals(kind);
        int id = it.optInt("id");
        PendingIntent tap = openApp(ctx, backup ? "backup" : "play", 8000 + id);
        String text = it.optString("text");
        NotificationCompat.Builder b = new NotificationCompat.Builder(ctx, backup ? CH_BACKUP : ready ? CH_READY : CH_DAILY)
            .setSmallIcon(R.drawable.ic_stat_mn)
            .setContentTitle(it.optString("title"))
            .setContentText(it.optString("short", text))
            .setStyle(new NotificationCompat.BigTextStyle().bigText(text))
            .setColor(0xFFFFB020)
            .setAutoCancel(true)
            .setContentIntent(tap)
            .setPriority(backup ? NotificationCompat.PRIORITY_DEFAULT : NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_REMINDER)
            // Android 7 and older have no channels: the sound goes on the note itself.
            .setSound(chime(ctx));
        if (backup) {
            b.addAction(0, "Back up now", tap);
            Intent later = new Intent(ctx, ReminderReceiver.class).setAction(ACTION_LATER).putExtra("id", id);
            b.addAction(0, "In 3 days", PendingIntent.getBroadcast(ctx, 9000 + id, later, PendingIntent.FLAG_UPDATE_CURRENT | immutable()));
        } else {
            b.addAction(0, ready ? "Open MN" : "Play now", tap);
        }
        try {
            NotificationManagerCompat.from(ctx).notify(id, b.build());
        } catch (SecurityException ignored) {
            // Notifications switched off meanwhile.
        }
    }

    /** "In 3 days" on the backup note: quiet until then (the app reads this back too). */
    static void snoozeBackup(Context ctx, int id) {
        NotificationManagerCompat.from(ctx).cancel(id);
        prefs(ctx).edit().putLong(KEY_SNOOZE, System.currentTimeMillis() + 3 * DAY).apply();
        schedule(ctx);
    }
}
