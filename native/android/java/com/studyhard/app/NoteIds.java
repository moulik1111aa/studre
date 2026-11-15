package com.studyhard.app;

/**
 * Notification ids for reminders (review fix 10). Each day's reminder has its own alarm, but
 * they share one notification, so a new day's note replaces the one before instead of piling up
 * when MN isn't opened for a few days. Plain Java (tested by scripts/check-release.sh).
 */
final class NoteIds {
    static final int DAILY = 100;
    static final int READY = 80;

    private NoteIds() {}

    /** The notification id for a plan item (its own id stays the alarm's). */
    static int forItem(String kind, int itemId) {
        if ("daily".equals(kind)) return DAILY;
        if ("ready".equals(kind)) return READY;
        return itemId;
    }
}
