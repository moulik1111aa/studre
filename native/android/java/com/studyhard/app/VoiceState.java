package com.studyhard.app;

/**
 * Whether the phone's speech engine can talk, and a line waiting for it to start (review fix
 * 10). Plain Java, so scripts/check-release.sh can test it without the Android SDK.
 *
 * starting → ready, or → none when the engine fails to start or has no English voice. With
 * none, nothing waits and nothing is "speaking", so the app moves on and the Parent area can
 * say to install a voice.
 */
final class VoiceState {
    static final String STARTING = "starting";
    static final String READY = "ready";
    static final String NONE = "none";
    /** A line waits this long at most for an engine that never says it has started. */
    static final long WAIT_MS = 10_000;

    private String state = STARTING;
    private String pending = null;
    private long pendingAt = 0;

    synchronized String state() {
        return state;
    }

    /** The engine has started (english: an English voice can speak). Returns the line to say now, if any. */
    synchronized String started(boolean ok, boolean english) {
        state = ok && english ? READY : NONE;
        String line = READY.equals(state) ? pending : null;
        pending = null;
        return line;
    }

    /** Before the engine is ready, keep the line for later (true); otherwise false (say it now, or not at all). */
    synchronized boolean queue(String text, long now) {
        if (!STARTING.equals(state)) return false;
        pending = text;
        pendingAt = now;
        return true;
    }

    synchronized void stop() {
        pending = null;
    }

    /** Still talking? `engine`: what the engine says while it is ready. */
    synchronized boolean speaking(boolean engine, long now) {
        if (READY.equals(state)) return engine;
        if (STARTING.equals(state) && pending != null && now - pendingAt < WAIT_MS) return true;
        pending = null;
        return false;
    }
}
