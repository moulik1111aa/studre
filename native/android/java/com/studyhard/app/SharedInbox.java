package com.studyhard.app;

import android.content.Intent;
import android.net.Uri;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.Executor;

/**
 * A file shared to MN (Share or Open with, from Files, Drive, Gmail, WhatsApp…): taken from the
 * intent on the main thread, read on a background thread, then handed to the web app once.
 *
 * - Only content:// files from other apps are read: file:// paths and MN's own providers are refused.
 * - Reading stops at LIMIT bytes (an MN backup is far smaller).
 * - An intent Android delivers again when the app is reopened from Recents is ignored, so a
 *   restore that was handled (or turned down) doesn't come back.
 */
final class SharedInbox {
    /** The largest file read: MN backups are well under 1 MB. */
    static final int LIMIT = 10 * 1024 * 1024;

    /** Why a shared file wasn't read (the web app turns these into a message). */
    static final String TOO_BIG = "too-big", UNSUPPORTED = "unsupported", UNREADABLE = "unreadable";

    /** The file system side: opening and naming a file, and knowing MN's own providers. */
    interface Files {
        InputStream open(Uri uri) throws IOException;

        String name(Uri uri);

        /** Whether this content authority belongs to MN itself. */
        boolean ours(String authority);
    }

    /** Told (from the background thread) when a file has been read or refused. */
    interface Arrived {
        void arrived();
    }

    private final Files files;
    private final Executor worker;
    private final Arrived arrived;
    private String text, name, error;

    SharedInbox(Files files, Executor worker, Arrived arrived) {
        this.files = files;
        this.worker = worker;
        this.arrived = arrived;
    }

    /** Android delivered this intent again because the app was reopened from Recents. */
    static boolean fromHistory(Intent intent) {
        return intent != null && (intent.getFlags() & Intent.FLAG_ACTIVITY_LAUNCHED_FROM_HISTORY) != 0;
    }

    /**
     * Take a shared or opened file from the intent (main thread). It is read on the worker, and
     * `arrived` is called when it is ready. Returns whether the intent carried one. The intent is
     * cleared, so the same activity doesn't take it twice.
     */
    @SuppressWarnings("deprecation")
    boolean take(Intent intent) {
        if (intent == null || fromHistory(intent)) return false;
        String action = intent.getAction();
        Uri uri = null;
        if (Intent.ACTION_SEND.equals(action)) {
            uri = intent.getParcelableExtra(Intent.EXTRA_STREAM);
            if (uri == null) {
                CharSequence t = intent.getCharSequenceExtra(Intent.EXTRA_TEXT);
                if (t == null || t.length() == 0) return false;
                intent.setAction(Intent.ACTION_MAIN);
                intent.removeExtra(Intent.EXTRA_TEXT);
                final String s = t.length() > LIMIT ? null : t.toString();
                worker.execute(() -> done(s, "", s == null ? TOO_BIG : null));
                return true;
            }
        } else if (Intent.ACTION_VIEW.equals(action)) {
            uri = intent.getData();
        }
        if (uri == null) return false;
        intent.setAction(Intent.ACTION_MAIN);
        intent.setData(null);
        intent.removeExtra(Intent.EXTRA_STREAM);
        final Uri u = uri;
        worker.execute(() -> {
            String refused = refuse(u);
            if (refused != null) {
                done(null, null, refused);
                return;
            }
            try (InputStream in = files.open(u)) {
                if (in == null) {
                    done(null, null, UNREADABLE);
                    return;
                }
                String t = read(in, LIMIT);
                done(t, t == null ? null : files.name(u), t == null ? TOO_BIG : null);
            } catch (Exception e) {
                done(null, null, UNREADABLE);
            }
        });
        return true;
    }

    /** Why this file must not be read, or null: only content:// from other apps. */
    String refuse(Uri uri) {
        if (!"content".equals(uri.getScheme())) return UNSUPPORTED;
        String a = uri.getAuthority();
        if (a == null || a.isEmpty() || files.ours(a)) return UNSUPPORTED;
        return null;
    }

    /** The text of a stream, or null when it is longer than `limit` bytes (reading stops there). */
    static String read(InputStream in, int limit) throws IOException {
        ByteArrayOutputStream buf = new ByteArrayOutputStream();
        byte[] chunk = new byte[65536];
        int n;
        while ((n = in.read(chunk)) > 0) {
            if (buf.size() + n > limit) return null;
            buf.write(chunk, 0, n);
        }
        return new String(buf.toByteArray(), StandardCharsets.UTF_8);
    }

    private void done(String text, String name, String error) {
        synchronized (this) {
            this.text = text;
            this.name = name;
            this.error = error;
        }
        arrived.arrived();
    }

    /** The file waiting for the web app, once: { text, name, error }, any of them null. */
    synchronized String[] collect() {
        String[] r = { text, name, error };
        text = name = error = null;
        return r;
    }
}
