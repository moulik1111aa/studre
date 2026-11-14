package com.studyhard.app;

import java.io.File;
import java.io.FileOutputStream;
import java.nio.file.Files;
import java.util.List;

/** Run by scripts/check-local.sh: LocalData's photo list and folder deletion (review fix 8). */
public class LocalTest {
    static int failed = 0;

    static void check(boolean ok, String what) {
        System.out.println((ok ? "ok - " : "FAIL - ") + what);
        if (!ok) failed++;
    }

    static void touch(File f) throws Exception {
        f.getParentFile().mkdirs();
        try (FileOutputStream out = new FileOutputStream(f)) {
            out.write(new byte[] { 1, 2, 3 });
        }
    }

    public static void main(String[] args) throws Exception {
        File root = Files.createTempDirectory("mn-local").toFile();
        File photos = new File(root, "photos");

        check(LocalData.photoIds(photos).isEmpty(), "no photos folder: no photos");

        touch(LocalData.photoFile(photos, "pabc"));
        touch(LocalData.photoFile(photos, "pdef"));
        touch(new File(photos, "notes.txt"));
        List<String> ids = LocalData.photoIds(photos);
        check(ids.size() == 2 && ids.contains("pabc") && ids.contains("pdef"), "lists the two photos, not other files: " + ids);

        check(LocalData.photoFile(photos, "../../save").getParentFile().equals(photos), "an id can't point outside the photos folder");

        File share = new File(root, "cache/share");
        touch(new File(share, "MN progress.html"));
        touch(new File(share, "inner/report.pdf"));
        check(LocalData.deleteTree(share) && !share.exists(), "the share folder and what's inside it are deleted");
        check(new File(root, "cache").exists(), "the folder above it is kept");

        check(LocalData.deleteTree(photos) && !photos.exists(), "every photo is deleted");
        check(LocalData.photoIds(photos).isEmpty(), "and none are listed afterwards");
        check(LocalData.deleteTree(photos), "deleting a folder that's already gone is fine");

        LocalData.deleteTree(root);
        if (failed > 0) {
            System.out.println(failed + " check(s) failed");
            System.exit(1);
        }
        System.out.println("all local-data checks passed");
    }
}
