package com.studyhard.app;

import android.content.Intent;
import android.net.Uri;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;

/** Review fix 6: a file shared to MN is read off the main thread, only from other apps, at most 10 MB, and once. */
public class SharedTest {
    static int fails = 0;
    static void check(boolean ok, String what) { System.out.println((ok ? "ok - " : "FAIL - ") + what); if (!ok) fails++; }

    /** The fake phone: what each content link holds, which thread opened it, how much was read. */
    static final class Phone implements SharedInbox.Files {
        final List<String> opened = new ArrayList<>();
        Thread openedOn = null;
        final AtomicInteger bytesRead = new AtomicInteger();
        String body = "<html>MN backup</html>";
        long size = -1;
        public InputStream open(Uri uri) throws IOException {
            opened.add(uri.toString());
            openedOn = Thread.currentThread();
            if (size < 0) return new ByteArrayInputStream(body.getBytes("UTF-8"));
            return new InputStream() {          // a big file, counted as it is read
                long left = size;
                public int read() { if (left-- <= 0) return -1; bytesRead.incrementAndGet(); return 'x'; }
                public int read(byte[] b, int off, int len) { if (left <= 0) return -1; int n = (int) Math.min(len, left); left -= n; bytesRead.addAndGet(n); return n; }
            };
        }
        public String name(Uri uri) { return "MN-family-backup.html"; }
        public boolean ours(String authority) { return authority.startsWith("app.missionnext.mn"); }
    }

    /** Runs nothing until told: shows that take() itself never reads. */
    static final class Later implements java.util.concurrent.Executor {
        final List<Runnable> queue = new ArrayList<>();
        public void execute(Runnable r) { queue.add(r); }
        void runOnAnotherThread() throws InterruptedException { Thread t = new Thread(() -> { for (Runnable r : queue) r.run(); queue.clear(); }, "share-reader"); t.start(); t.join(); }
    }

    static Intent send(String uri) { return new Intent(Intent.ACTION_SEND).putExtra(Intent.EXTRA_STREAM, Uri.parse(uri)); }

    public static void main(String[] a) throws Exception {
        Thread main = Thread.currentThread();
        {
            Phone p = new Phone(); Later w = new Later(); AtomicInteger told = new AtomicInteger();
            SharedInbox box = new SharedInbox(p, w, told::incrementAndGet);
            Intent i = send("content://com.google.android.apps.docs.files/document/123");
            check(box.take(i), "a backup shared from Drive is taken");
            check(p.opened.isEmpty(), "take() returns without opening the file (nothing read on the main thread)");
            w.runOnAnotherThread();
            check(p.openedOn != null && p.openedOn != main, "the file is read on a background thread");
            String[] f = box.collect();
            check("<html>MN backup</html>".equals(f[0]) && "MN-family-backup.html".equals(f[1]) && f[2] == null, "its text and name reach the web app");
            check(told.get() == 1, "the web app is told once");
            check(box.collect()[0] == null, "and collects it once");
            check(!box.take(i), "the same intent isn't taken twice (it was cleared)");
        }
        {
            Phone p = new Phone(); Later w = new Later();
            SharedInbox box = new SharedInbox(p, w, () -> {});
            Intent i = new Intent(Intent.ACTION_VIEW).setData(Uri.parse("content://com.whatsapp.provider.media/item/9"));
            check(box.take(i), "Open with from WhatsApp is taken");
            w.runOnAnotherThread();
            check(box.collect()[0] != null, "and read");
        }
        for (String bad : new String[] { "file:///sdcard/Download/MN-family-backup.html", "content://app.missionnext.mn.fileprovider/mn_share/x.html", "content://app.missionnext.mn/data", "https://example.com/x.html" }) {
            Phone p = new Phone(); Later w = new Later();
            SharedInbox box = new SharedInbox(p, w, () -> {});
            box.take(send(bad));
            w.runOnAnotherThread();
            String[] f = box.collect();
            check(p.opened.isEmpty() && f[0] == null && SharedInbox.UNSUPPORTED.equals(f[2]), "refused without opening: " + bad);
        }
        {
            Phone p = new Phone(); p.size = 25L * 1024 * 1024; Later w = new Later();
            SharedInbox box = new SharedInbox(p, w, () -> {});
            box.take(send("content://com.android.providers.downloads.documents/document/7"));
            w.runOnAnotherThread();
            String[] f = box.collect();
            check(f[0] == null && SharedInbox.TOO_BIG.equals(f[2]), "a 25 MB file is refused as too big");
            check(p.bytesRead.get() <= SharedInbox.LIMIT + 65536, "reading stopped near 10 MB (read " + p.bytesRead.get() / 1024 / 1024 + " MB)");
        }
        {
            Phone p = new Phone(); p.size = SharedInbox.LIMIT; Later w = new Later();
            SharedInbox box = new SharedInbox(p, w, () -> {});
            box.take(send("content://com.android.providers.downloads.documents/document/8"));
            w.runOnAnotherThread();
            check(box.collect()[0] != null, "a file of exactly 10 MB is still read");
        }
        {
            Phone p = new Phone(); Later w = new Later(); AtomicInteger told = new AtomicInteger();
            SharedInbox box = new SharedInbox(p, w, told::incrementAndGet);
            Intent again = send("content://com.google.android.apps.docs.files/document/123").addFlags(Intent.FLAG_ACTIVITY_LAUNCHED_FROM_HISTORY);
            check(!box.take(again), "reopened from Recents: the share is not taken again");
            w.runOnAnotherThread();
            check(p.opened.isEmpty() && told.get() == 0, "nothing read, nothing shown");
            check(SharedInbox.fromHistory(again), "and the reminder's mn_open extra is skipped the same way (fromHistory)");
        }
        {
            Phone p = new Phone(); Later w = new Later();
            SharedInbox box = new SharedInbox(p, w, () -> {});
            Intent t = new Intent(Intent.ACTION_SEND).putExtra(Intent.EXTRA_TEXT, "{\"format\":\"mn-family-backup\"}");
            check(box.take(t), "a backup shared as text (from an app that sends .json as text) is taken");
            w.runOnAnotherThread();
            check("{\"format\":\"mn-family-backup\"}".equals(box.collect()[0]), "and handed over");
        }
        System.out.println(fails == 0 ? "all shared-file checks passed" : fails + " check(s) failed");
        System.exit(fails == 0 ? 0 : 1);
    }
}
