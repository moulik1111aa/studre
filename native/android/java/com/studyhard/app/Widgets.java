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
 * when the app isn't opened), a fun fact with a "Next" button, and the Adventure level card.
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

    // ── Adventure ───────────────────────────────────────────────────────────
    static RemoteViews adventure(Context ctx, JSONObject d) {
        RemoteViews v = new RemoteViews(ctx.getPackageName(), R.layout.widget_adventure);
        v.setOnClickPendingIntent(R.id.w_root, Reminders.openApp(ctx, "play", 8300));
        JSONObject a = d.optJSONObject("adventure");
        if (a == null) {
            v.setTextViewText(R.id.a_icon, "🗺️");
            v.setTextViewText(R.id.a_level, "Adventure");
            v.setTextViewText(R.id.a_rank, "A grown-up can switch it on in the Parent area");
            v.setViewVisibility(R.id.a_bar, View.GONE);
            v.setTextViewText(R.id.a_line, "Quests · badges · levels");
            return v;
        }
        String today = today();
        int need = a.optInt("need");
        int into = a.optInt("into");
        v.setViewVisibility(R.id.a_bar, View.VISIBLE);
        v.setTextViewText(R.id.a_icon, str(a, "rankIcon"));
        v.setTextViewText(R.id.a_level, "Level " + a.optInt("level"));
        v.setTextViewText(R.id.a_rank, str(a, "name") + " · " + str(a, "rank"));
        v.setProgressBar(R.id.a_bar, Math.max(1, need), need > 0 ? into : 1, false);
        int quests = today.equals(str(a, "questDay")) ? a.optInt("quests") : 0;
        int streak = a.optInt("streak");
        String last = str(a, "streakDay");
        long since = last.isEmpty() ? 99 : days(last, today);
        String flame = since <= 1 && streak > 0 ? "🔥 " + streak + (streak == 1 ? " day" : " days") : "🔥 Start a streak";
        v.setTextViewText(R.id.a_line, "📜 " + quests + "/3 quests · " + flame);
        return v;
    }
}
