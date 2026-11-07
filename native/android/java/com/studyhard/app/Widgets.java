package com.studyhard.app;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.view.View;
import android.widget.RemoteViews;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.TimeZone;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * The home-screen widgets: treat jars (melting worked out here, so the line stays right even
 * when the app isn't opened), a fun fact with a "Next" button, "MN today" (the week played
 * and the streak) and the MN × Focus plan.
 * Their data comes from the web app with each reminders plan (src/core/reminders.ts).
 */
final class Widgets {

    static final String KEY_WIDGET = "widget";
    static final String KEY_FACT_TAPS = "factTaps";

    private Widgets() {}

    static void store(Context ctx, String json) {
        Reminders.prefs(ctx).edit().putString(KEY_WIDGET, json).apply();
    }

    static JSONObject data(Context ctx) {
        try {
            return new JSONObject(Reminders.prefs(ctx).getString(KEY_WIDGET, "{}"));
        } catch (Exception e) {
            return new JSONObject();
        }
    }

    static void updateAll(Context ctx) {
        AppWidgetManager m = AppWidgetManager.getInstance(ctx);
        if (m == null) return;
        update(ctx, m, JarWidget.class);
        update(ctx, m, FactWidget.class);
        update(ctx, m, AdventureWidget.class);
        update(ctx, m, FocusWidget.class);
    }

    static void update(Context ctx, AppWidgetManager m, Class<?> kind) {
        int[] ids = m.getAppWidgetIds(new ComponentName(ctx, kind));
        if (ids == null) return;
        for (int id : ids) {
            try {
                m.updateAppWidget(id, views(ctx, kind));
            } catch (Exception ignored) {
                // The launcher went away meanwhile.
            }
        }
    }

    static RemoteViews views(Context ctx, Class<?> kind) {
        JSONObject d = data(ctx);
        if (kind == FactWidget.class) return fact(ctx, d);
        if (kind == AdventureWidget.class) return adventure(ctx, d);
        if (kind == FocusWidget.class) return focus(ctx, d);
        return jar(ctx, d);
    }

    static String today() {
        return new SimpleDateFormat("yyyy-MM-dd", Locale.US).format(new Date());
    }

    /** Whole days from local day a to local day b (both YYYY-MM-DD). */
    static long days(String a, String b) {
        try {
            SimpleDateFormat f = new SimpleDateFormat("yyyy-MM-dd", Locale.US);
            f.setTimeZone(TimeZone.getTimeZone("UTC"));
            Date da = f.parse(a);
            Date db = f.parse(b);
            if (da == null || db == null) return 0;
            return Math.round((db.getTime() - da.getTime()) / 86_400_000.0);
        } catch (Exception e) {
            return 0;
        }
    }

    static String str(JSONObject o, String key) {
        return o == null || o.isNull(key) ? "" : o.optString(key, "");
    }

    // ── treat jars ──────────────────────────────────────────────────────────
    static RemoteViews jar(Context ctx, JSONObject d) {
        RemoteViews v = new RemoteViews(ctx.getPackageName(), R.layout.widget_jar);
        v.setOnClickPendingIntent(R.id.w_root, Reminders.openApp(ctx, "play", 8100));
        JSONArray kids = d.optJSONArray("kids");
        boolean holiday = d.optBoolean("holiday");
        int n = kids == null ? 0 : Math.min(2, kids.length());
        int[][] ids = {
            { R.id.k1, R.id.k1_av, R.id.k1_name, R.id.k1_bar, R.id.k1_status, R.id.k1_pct },
            { R.id.k2, R.id.k2_av, R.id.k2_name, R.id.k2_bar, R.id.k2_status, R.id.k2_pct },
        };
        String today = today();
        for (int i = 0; i < 2; i++) {
            JSONObject k = i < n ? kids.optJSONObject(i) : null;
            if (k == null) {
                v.setViewVisibility(ids[i][0], View.GONE);
                continue;
            }
            v.setViewVisibility(ids[i][0], View.VISIBLE);
            double coins = k.optDouble("coins", 0);
            double cost = Math.max(1, k.optDouble("cost", 1));
            double base = k.optDouble("base", cost);
            double rate = k.optDouble("rate", 0.05);
            boolean waiting = k.optBoolean("waiting");
            String last = str(k, "lastPlay");
            long since = last.isEmpty() ? -1 : days(last, today);
            long missed = since < 0 ? 0 : Math.max(0, since - 1);
            double now = waiting || holiday ? coins : Math.max(0, coins - missed * rate * base);
            int pct = (int) Math.min(100, Math.floor(100 * now / cost));
            String status;
            if (waiting) status = "🎁 Ready to be given!";
            else if (holiday) status = "🏖️ Holiday: nothing melts";
            else if (since < 0) status = "Play a level to start filling it";
            else if (since == 0) status = "❄️ Frozen today. Well done!";
            else if (since == 1) status = "⏳ Play today or it melts tonight";
            else status = "🫠 Melting! −" + Math.round(100 * (coins - now) / cost) + "% so far";
            v.setTextViewText(ids[i][1], str(k, "avatar"));
            v.setTextViewText(ids[i][2], str(k, "name") + " · " + str(k, "icon") + " " + str(k, "reward"));
            v.setProgressBar(ids[i][3], 100, pct, false);
            v.setTextViewText(ids[i][4], status);
            v.setTextViewText(ids[i][5], pct + "%");
        }
        v.setViewVisibility(R.id.w_empty, n == 0 ? View.VISIBLE : View.GONE);
        return v;
    }

    // ── fun fact ────────────────────────────────────────────────────────────
    static RemoteViews fact(Context ctx, JSONObject d) {
        RemoteViews v = new RemoteViews(ctx.getPackageName(), R.layout.widget_fact);
        JSONArray facts = d.optJSONArray("facts");
        String text = "Open MN once and the fun facts will appear here.";
        if (facts != null && facts.length() > 0) {
            long day = days("2026-01-01", today());
            int taps = Reminders.prefs(ctx).getInt(KEY_FACT_TAPS, 0);
            int len = facts.length();
            int i = (int) (((day + taps) % len + len) % len);
            text = facts.optString(i, text);
        }
        v.setTextViewText(R.id.f_text, text);
        Intent next = new Intent(ctx, FactWidget.class).setAction(FactWidget.NEXT);
        v.setOnClickPendingIntent(R.id.f_next, PendingIntent.getBroadcast(ctx, 8200, next, PendingIntent.FLAG_UPDATE_CURRENT | Reminders.immutable()));
        v.setOnClickPendingIntent(R.id.f_text, Reminders.openApp(ctx, "play", 8201));
        return v;
    }

    static void nextFact(Context ctx) {
        SharedPreferences p = Reminders.prefs(ctx);
        p.edit().putInt(KEY_FACT_TAPS, p.getInt(KEY_FACT_TAPS, 0) + 1).apply();
    }

    // ── MN today (was the Adventure card) ───────────────────────────────────
    private static final int[] DOTS = { R.id.d0, R.id.d1, R.id.d2, R.id.d3, R.id.d4, R.id.d5, R.id.d6 };
    private static final int[] LETTERS = { R.id.d0_l, R.id.d1_l, R.id.d2_l, R.id.d3_l, R.id.d4_l, R.id.d5_l, R.id.d6_l };
    private static final String WEEKDAY = "SMTWTFS"; // Calendar.SUNDAY is 1

    static RemoteViews adventure(Context ctx, JSONObject d) {
        RemoteViews v = new RemoteViews(ctx.getPackageName(), R.layout.widget_adventure);
        v.setOnClickPendingIntent(R.id.w_root, Reminders.openApp(ctx, "play", 8300));
        JSONObject day = d.optJSONObject("day");
        JSONObject a = d.optJSONObject("adventure");
        String today = today();

        // The last 7 days, today on the right.
        JSONObject played = day == null ? null : day.optJSONObject("days");
        SimpleDateFormat f = new SimpleDateFormat("yyyy-MM-dd", Locale.US);
        java.util.Calendar cal = java.util.Calendar.getInstance();
        cal.add(java.util.Calendar.DAY_OF_YEAR, -6);
        for (int i = 0; i < 7; i++) {
            String key = f.format(cal.getTime());
            boolean on = played != null && played.optInt(key, 0) > 0;
            boolean isToday = i == 6;
            v.setTextViewText(LETTERS[i], String.valueOf(WEEKDAY.charAt(cal.get(java.util.Calendar.DAY_OF_WEEK) - 1)));
            v.setInt(DOTS[i], "setBackgroundResource", isToday ? (on ? R.drawable.widget_dot_today_on : R.drawable.widget_dot_today) : (on ? R.drawable.widget_dot_on : R.drawable.widget_dot_off));
            v.setTextViewText(DOTS[i], on ? "✓" : "");
            cal.add(java.util.Calendar.DAY_OF_YEAR, 1);
        }

        if (day == null) {
            v.setTextViewText(R.id.a_icon, "🚀");
            v.setTextViewText(R.id.a_title, "MN");
            v.setTextViewText(R.id.a_streak, "🔥 0");
            v.setTextViewText(R.id.a_line, "Open MN once to fill this in");
            v.setViewVisibility(R.id.a_adv, View.GONE);
            return v;
        }

        String name = str(day, "name");
        v.setTextViewText(R.id.a_icon, str(day, "avatar"));
        v.setTextViewText(R.id.a_title, name.isEmpty() ? "This week" : name + "'s week");
        int streak = day.optInt("streak");
        String last = str(day, "streakDay");
        long since = last.isEmpty() ? 99 : days(last, today);
        boolean alive = since <= 1 && streak > 0;
        v.setTextViewText(R.id.a_streak, "🔥 " + (alive ? streak : 0));

        int secs = played == null ? 0 : played.optInt(today, 0);
        String line;
        if (secs > 0) line = (secs < 60 ? "Under a minute" : (secs / 60) + " min") + " today";
        else if (alive) line = "Play today to keep the streak";
        else line = "Tap to play today";
        if (a != null) {
            int quests = today.equals(str(a, "questDay")) ? a.optInt("quests") : 0;
            line += " · " + quests + "/3 quests";
        }
        v.setTextViewText(R.id.a_line, line);

        if (a != null) {
            int need = a.optInt("need");
            int into = a.optInt("into");
            v.setViewVisibility(R.id.a_adv, View.VISIBLE);
            v.setTextViewText(R.id.a_level, "Lv " + a.optInt("level"));
            v.setProgressBar(R.id.a_bar, Math.max(1, need), need > 0 ? into : 1, false);
        } else {
            v.setViewVisibility(R.id.a_adv, View.GONE);
        }
        return v;
    }

    // ── Focus plan (MN ×) ───────────────────────────────────────────────────
    private static final int[][] FOCUS_ROWS = {
        { R.id.f0, R.id.f0_name, R.id.f0_pct },
        { R.id.f1, R.id.f1_name, R.id.f1_pct },
        { R.id.f2, R.id.f2_name, R.id.f2_pct },
    };

    static RemoteViews focus(Context ctx, JSONObject d) {
        RemoteViews v = new RemoteViews(ctx.getPackageName(), R.layout.widget_focus);
        JSONObject fo = d.optJSONObject("focus");
        boolean locked = fo == null || fo.optBoolean("locked");
        v.setOnClickPendingIntent(R.id.w_root, Reminders.openApp(ctx, locked ? "mnx" : "focus", 8400));
        String name = fo == null ? "" : str(fo, "name");
        v.setTextViewText(R.id.f_title, name.isEmpty() ? "Focus plan" : name + "'s focus");
        JSONArray skills = fo == null ? null : fo.optJSONArray("skills");
        int n = skills == null ? 0 : Math.min(3, skills.length());
        for (int i = 0; i < 3; i++) {
            JSONObject sk = i < n ? skills.optJSONObject(i) : null;
            if (sk == null) {
                v.setViewVisibility(FOCUS_ROWS[i][0], View.GONE);
                continue;
            }
            v.setViewVisibility(FOCUS_ROWS[i][0], View.VISIBLE);
            v.setTextViewText(FOCUS_ROWS[i][1], str(sk, "name"));
            int before = sk.optInt("before");
            boolean hasNow = !sk.isNull("now") && sk.has("now");
            int now = sk.optInt("now");
            String pct = hasNow ? before + "% → " + now + "%" : before + "%";
            v.setTextViewText(FOCUS_ROWS[i][2], pct);
            int color = !hasNow ? 0xFF6C47FF : now - before >= 5 ? 0xFF1E9E5A : before - now >= 5 ? 0xFFD9534F : 0xFF6C47FF;
            v.setTextColor(FOCUS_ROWS[i][2], color);
        }
        String foot;
        if (fo == null) foot = "Open MN once to fill this in";
        else if (locked) foot = "Sample numbers. Tap to see what MN × adds";
        else if (n == 0) foot = "The plan appears after a few days of play";
        else {
            int rounds = fo.optInt("rounds");
            int goal = Math.max(1, fo.optInt("goal", 3));
            foot = rounds >= goal ? "This week's Focus rounds are done ✓" : "Focus rounds: " + rounds + " of " + goal + " this week. Tap to play one";
        }
        v.setTextViewText(R.id.f_foot, foot);
        return v;
    }
}
