package com.studyhard.app;

import java.io.File;
import java.util.ArrayList;
import java.util.List;

/**
 * Files MN keeps on the phone outside the save: the reward photos (files/photos/<id>.jpg) and
 * files made for sharing (cache/share). Plain Java, so scripts/check-local.sh can test it
 * without the Android SDK.
 */
final class LocalData {

    private LocalData() {}

    /** The photo file for an id (letters, digits, _ and - only, so an id can't leave the folder). */
    static File photoFile(File photos, String id) {
        return new File(photos, id.replaceAll("[^A-Za-z0-9_-]", "_") + ".jpg");
    }

    /** The ids of the photos in the folder (none when it doesn't exist). */
    static List<String> photoIds(File photos) {
        List<String> ids = new ArrayList<>();
        File[] files = photos.listFiles();
        if (files == null) return ids;
        for (File f : files) {
            String n = f.getName();
            if (f.isFile() && n.endsWith(".jpg")) ids.add(n.substring(0, n.length() - 4));
        }
        return ids;
    }

    /** Deletes a folder and everything in it. Returns false if something couldn't be deleted. */
    static boolean deleteTree(File dir) {
        if (!dir.exists()) return true;
        boolean ok = true;
        File[] files = dir.listFiles();
        if (files != null) {
            for (File f : files) ok &= f.isDirectory() ? deleteTree(f) : f.delete();
        }
        return dir.delete() && ok;
    }
}
