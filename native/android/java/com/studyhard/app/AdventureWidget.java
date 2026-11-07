package com.studyhard.app;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;

/**
 * Home-screen widget "MN today": the last 7 days played, today's minutes, the streak, and the
 * Adventure level when it's on. (Still called AdventureWidget so widgets already placed keep working.)
 */
public class AdventureWidget extends AppWidgetProvider {
    @Override
    public void onUpdate(Context ctx, AppWidgetManager m, int[] ids) {
        for (int id : ids) m.updateAppWidget(id, Widgets.views(ctx, AdventureWidget.class));
    }
}
