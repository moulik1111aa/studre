package com.studyhard.app;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;

/** Home-screen widget: the Adventure level, rank, XP bar, today's quests and the streak. */
public class AdventureWidget extends AppWidgetProvider {
    @Override
    public void onUpdate(Context ctx, AppWidgetManager m, int[] ids) {
        for (int id : ids) m.updateAppWidget(id, Widgets.views(ctx, AdventureWidget.class));
    }
}
