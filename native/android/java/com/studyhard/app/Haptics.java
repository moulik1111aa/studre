package com.studyhard.app;

import android.media.AudioAttributes;
import android.os.Build;
import android.os.VibrationAttributes;
import android.os.VibrationEffect;
import android.os.Vibrator;
import androidx.annotation.RequiresApi;

/**
 * The plugin's haptics. Kept out of StudyHardPlugin on purpose: Capacitor lists every method
 * of a plugin class when it starts, and on Android 7 (API 24 and 25) a method that returns a
 * VibrationEffect (Android 8) makes that listing fail, so MN closed as soon as it opened there
 * (found by the release check, review fix 10).
 */
final class Haptics {
    private Haptics() {}

    static void play(Vibrator vibrator, String kind) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            vibrator.vibrate(legacyMillis(kind));
            return;
        }
        VibrationEffect effect = effectFor(vibrator, kind);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            vibrator.vibrate(effect, VibrationAttributes.createForUsage(VibrationAttributes.USAGE_MEDIA));
        } else {
            AudioAttributes audio = new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_GAME).build();
            vibrator.vibrate(effect, audio);
        }
    }

    @RequiresApi(Build.VERSION_CODES.O)
    private static VibrationEffect effectFor(Vibrator vibrator, String kind) {
        switch (kind) {
            case "match":
                return Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q
                    ? VibrationEffect.createPredefined(VibrationEffect.EFFECT_CLICK)
                    : VibrationEffect.createOneShot(14, 180);
            case "combo":
                return Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q
                    ? VibrationEffect.createPredefined(VibrationEffect.EFFECT_DOUBLE_CLICK)
                    : waveform(new long[] { 0, 14, 40, 22 }, new int[] { 0, 180, 0, 230 });
            case "heartbeat":
                return waveform(new long[] { 0, 18, 90, 26 }, new int[] { 0, 140, 0, 210 });
            case "win":
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R &&
                    vibrator.areAllPrimitivesSupported(
                        VibrationEffect.Composition.PRIMITIVE_SLOW_RISE,
                        VibrationEffect.Composition.PRIMITIVE_CLICK
                    )) {
                    return VibrationEffect.startComposition()
                        .addPrimitive(VibrationEffect.Composition.PRIMITIVE_SLOW_RISE, 0.7f)
                        .addPrimitive(VibrationEffect.Composition.PRIMITIVE_CLICK, 1f, 60)
                        .addPrimitive(VibrationEffect.Composition.PRIMITIVE_CLICK, 1f, 90)
                        .compose();
                }
                return waveform(new long[] { 0, 30, 60, 30, 60, 70 }, new int[] { 0, 150, 0, 170, 0, 255 });
            case "lose":
                return waveform(new long[] { 0, 90, 70, 140 }, new int[] { 0, 200, 0, 255 });
            case "tap":
            default:
                return Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q
                    ? VibrationEffect.createPredefined(VibrationEffect.EFFECT_TICK)
                    : VibrationEffect.createOneShot(8, 90);
        }
    }

    @RequiresApi(Build.VERSION_CODES.O)
    private static VibrationEffect waveform(long[] timings, int[] amplitudes) {
        return VibrationEffect.createWaveform(timings, amplitudes, -1);
    }

    private static long legacyMillis(String kind) {
        switch (kind) {
            case "match":
            case "combo":
                return 16;
            case "heartbeat":
                return 30;
            case "win":
            case "lose":
                return 90;
            default:
                return 8;
        }
    }
}
