package com.studyhard.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import org.json.JSONObject;

/** Shows a planned note when its alarm goes off; puts the alarms back after a restart or update. */
public class ReminderReceiver extends BroadcastReceiver {

    @Override
    public void onReceive(Context ctx, Intent intent) {
        String action = intent.getAction();
        if (action == null) return;
        switch (action) {
            case Reminders.ACTION_FIRE:
                try {
                    String item = intent.getStringExtra("item");
                    if (item != null) Reminders.show(ctx, new JSONObject(item));
                } catch (Exception ignored) {
                    // A broken note: skip it.
                }
                // The jar widget's melting line changes through the day too.
                Widgets.updateAll(ctx);
                break;
            case Reminders.ACTION_LATER:
                Reminders.snoozeBackup(ctx, intent.getIntExtra("id", 0));
                break;
            case Intent.ACTION_BOOT_COMPLETED:
            case Intent.ACTION_MY_PACKAGE_REPLACED:
                Reminders.schedule(ctx);
                Widgets.updateAll(ctx);
                break;
            default:
                break;
        }
    }
}
