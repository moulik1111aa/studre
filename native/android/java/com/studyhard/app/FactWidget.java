package com.studyhard.app;

import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.Context;
import android.content.Intent;

/** Home-screen widget: a fun fact a day, and a "Next" button for another one. */
public class FactWidget extends AppWidgetProvider {

    static final String NEXT = "com.studyhard.app.FACT_NEXT";

    @Override
    public void onUpdate(Context ctx, AppWidgetManager m, int[] ids) {
        for (int id : ids) m.updateAppWidget(id, Widgets.views(ctx, FactWidget.class));
    }

    @Override
    public void onReceive(Context ctx, Intent intent) {
        super.onReceive(ctx, intent);
        if (NEXT.equals(intent.getAction())) {
            Widgets.nextFact(ctx);
            Widgets.update(ctx, AppWidgetManager.getInstance(ctx), FactWidget.class);
        }
    }
}
