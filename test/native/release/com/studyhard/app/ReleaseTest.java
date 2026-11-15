package com.studyhard.app;

/** Run by scripts/check-release.sh: the speech state and reminder notification ids (review fix 10). */
public class ReleaseTest {
    static int failed = 0;

    static void check(boolean ok, String what) {
        System.out.println((ok ? "ok - " : "FAIL - ") + what);
        if (!ok) failed++;
    }

    public static void main(String[] args) {
        // An engine that fails to start: the waiting line is dropped and nothing is "speaking".
        VoiceState v = new VoiceState();
        check(v.queue("Seven times eight?", 0), "a line waits while the engine starts");
        check(v.speaking(false, 100), "and counts as speaking while it waits");
        check(v.started(false, false) == null, "the engine fails: nothing to say");
        check(VoiceState.NONE.equals(v.state()), "the state is none");
        check(!v.speaking(false, 200), "nothing is speaking");
        check(!v.queue("Next question", 300), "later lines don't wait");

        // An engine with no English voice.
        v = new VoiceState();
        v.queue("Hello", 0);
        check(v.started(true, false) == null && VoiceState.NONE.equals(v.state()) && !v.speaking(false, 10), "no English voice: none, nothing waiting");

        // A good engine: the waiting line is said once it starts.
        v = new VoiceState();
        v.queue("Hello", 0);
        check("Hello".equals(v.started(true, true)), "ready: the waiting line is said");
        check(VoiceState.READY.equals(v.state()), "the state is ready");
        check(v.speaking(true, 10) && !v.speaking(false, 10), "speaking follows the engine");
        check(!v.queue("Next", 20), "lines are said straight away");

        // An engine that never answers: the line stops counting after a while.
        v = new VoiceState();
        v.queue("Hello", 0);
        check(v.speaking(false, VoiceState.WAIT_MS - 1), "waits a while");
        check(!v.speaking(false, VoiceState.WAIT_MS), "then stops waiting");
        check(!v.speaking(false, VoiceState.WAIT_MS + 1), "and the line is dropped");

        // Stopping drops a waiting line.
        v = new VoiceState();
        v.queue("Hello", 0);
        v.stop();
        check(!v.speaking(false, 1) && v.started(true, true) == null, "stop drops the waiting line");

        // Reminder notes: one per kind, so days don't pile up.
        check(NoteIds.forItem("daily", 101) == NoteIds.forItem("daily", 104), "every day's reminder uses one note");
        check(NoteIds.forItem("ready", 81) == NoteIds.forItem("ready", 83), "every reward-ready note uses one note");
        check(NoteIds.forItem("daily", 101) != NoteIds.forItem("ready", 81), "the two kinds don't replace each other");
        check(NoteIds.forItem("backup", 90) == 90, "the backup note keeps its id (its 'In 3 days' button cancels it)");

        if (failed > 0) {
            System.out.println(failed + " check(s) failed");
            System.exit(1);
        }
        System.out.println("all release checks passed");
    }
}
