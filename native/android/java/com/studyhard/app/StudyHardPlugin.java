package com.studyhard.app;

import android.content.Context;
import android.content.SharedPreferences;
import android.speech.tts.TextToSpeech;
import android.speech.tts.Voice;
import android.util.Base64;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.util.Locale;
import android.media.AudioAttributes;
import android.os.Build;
import android.os.VibrationAttributes;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.os.VibratorManager;
import android.view.Display;
import android.view.Window;
import android.view.WindowManager;
import androidx.activity.OnBackPressedCallback;
import androidx.annotation.RequiresApi;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.Map;

/**
 * Study Hard's bridge to the phone: haptics, the back button, full-screen display,
 * the highest refresh rate, keep-screen-on while playing, a native mirror of the save
 * (progress survives even if the WebView's storage is cleared), reading questions
 * aloud with the phone's English voice, and the reward photos parents attach.
 * The web side lives in src/platform/native.ts.
 */
@CapacitorPlugin(name = "StudyHard")
public class StudyHardPlugin extends Plugin {

    private static final String PREFS = "studyhard_save";
    private Vibrator vibrator;
    private TextToSpeech tts;
    private boolean ttsReady = false;

    @Override
    public void load() {
        Context ctx = getContext();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            VibratorManager vm = (VibratorManager) ctx.getSystemService(Context.VIBRATOR_MANAGER_SERVICE);
            vibrator = vm != null ? vm.getDefaultVibrator() : null;
        } else {
            vibrator = (Vibrator) ctx.getSystemService(Context.VIBRATOR_SERVICE);
        }

        tts = new TextToSpeech(ctx.getApplicationContext(), status -> {
            if (status != TextToSpeech.SUCCESS || tts == null) return;
            // Indian English first (familiar to the children), then British, then US.
            Locale[] wanted = { new Locale("en", "IN"), Locale.UK, Locale.US, Locale.ENGLISH };
            for (Locale l : wanted) {
                int r = tts.setLanguage(l);
                if (r != TextToSpeech.LANG_MISSING_DATA && r != TextToSpeech.LANG_NOT_SUPPORTED) {
                    ttsReady = true;
                    break;
                }
            }
            Voice best = bestVoice();
            if (best != null) tts.setVoice(best);
        });

        AppCompatActivity activity = getActivity();
        activity.runOnUiThread(() -> {
            immersive();
            preferHighestRefreshRate();
            activity
                .getOnBackPressedDispatcher()
                .addCallback(
                    activity,
                    new OnBackPressedCallback(true) {
                        @Override
                        public void handleOnBackPressed() {
                            // The game decides (close a sheet, pause, go home, or leave).
                            if (hasListeners("back")) {
                                notifyListeners("back", new JSObject());
                            } else {
                                activity.moveTaskToBack(true);
                            }
                        }
                    }
                );
        });
    }

    @Override
    protected void handleOnDestroy() {
        if (tts != null) {
            tts.stop();
            tts.shutdown();
            tts = null;
        }
        super.handleOnDestroy();
    }

    @Override
    protected void handleOnPause() {
        if (tts != null) tts.stop();
        super.handleOnPause();
    }

    @Override
    protected void handleOnResume() {
        super.handleOnResume();
        immersive();
    }

    /** Hide the status and navigation bars; a swipe from the edge shows them briefly. */
    private void immersive() {
        Window window = getActivity().getWindow();
        WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(window, window.getDecorView());
        controller.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
        controller.hide(WindowInsetsCompat.Type.systemBars());
    }

    /** Ask for the display's fastest mode at the current resolution (120 Hz on the OnePlus 13R). */
    private void preferHighestRefreshRate() {
        try {
            Window window = getActivity().getWindow();
            Display display = Build.VERSION.SDK_INT >= Build.VERSION_CODES.R
                ? getActivity().getDisplay()
                : getActivity().getWindowManager().getDefaultDisplay();
            if (display == null) return;
            Display.Mode current = display.getMode();
            Display.Mode best = current;
            for (Display.Mode mode : display.getSupportedModes()) {
                boolean sameSize =
                    mode.getPhysicalWidth() == current.getPhysicalWidth() && mode.getPhysicalHeight() == current.getPhysicalHeight();
                if (sameSize && mode.getRefreshRate() > best.getRefreshRate()) best = mode;
            }
            WindowManager.LayoutParams params = window.getAttributes();
            params.preferredDisplayModeId = best.getModeId();
            params.preferredRefreshRate = best.getRefreshRate();
            window.setAttributes(params);
        } catch (Exception ignored) {
            // Leave the system default.
        }
    }

    @PluginMethod
    public void haptic(PluginCall call) {
        String kind = call.getString("kind", "tap");
        try {
            if (vibrator != null && vibrator.hasVibrator()) vibrate(kind);
        } catch (Exception ignored) {
            // Haptics are a nicety; never fail the call.
        }
        call.resolve();
    }

    private void vibrate(String kind) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            vibrator.vibrate(legacyMillis(kind));
            return;
        }
        VibrationEffect effect = effectFor(kind);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            vibrator.vibrate(effect, VibrationAttributes.createForUsage(VibrationAttributes.USAGE_MEDIA));
        } else {
            AudioAttributes audio = new AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_GAME).build();
            vibrator.vibrate(effect, audio);
        }
    }

    @RequiresApi(Build.VERSION_CODES.O)
    private VibrationEffect effectFor(String kind) {
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

    @PluginMethod
    public void keepAwake(PluginCall call) {
        boolean on = Boolean.TRUE.equals(call.getBoolean("on", false));
        getActivity().runOnUiThread(() -> {
            if (on) getActivity().getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
            else getActivity().getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        });
        call.resolve();
    }

    @PluginMethod
    public void exit(PluginCall call) {
        call.resolve();
        getActivity().runOnUiThread(() -> getActivity().moveTaskToBack(true));
    }

    @PluginMethod
    public void readSave(PluginCall call) {
        JSObject values = new JSObject();
        for (Map.Entry<String, ?> entry : prefs().getAll().entrySet()) {
            if (entry.getValue() instanceof String) values.put(entry.getKey(), (String) entry.getValue());
        }
        JSObject result = new JSObject();
        result.put("values", values);
        call.resolve(result);
    }

    @PluginMethod
    public void writeSave(PluginCall call) {
        String key = call.getString("key");
        String value = call.getString("value");
        if (key == null || value == null) {
            call.reject("key and value are required");
            return;
        }
        prefs().edit().putString(key, value).apply();
        call.resolve();
    }

    /** English voices installed on the phone, best first. */
    private java.util.List<Voice> englishVoices() {
        java.util.List<Voice> out = new java.util.ArrayList<>();
        try {
            java.util.Set<Voice> all = tts.getVoices();
            if (all == null) return out;
            for (Voice v : all) {
                if (v.getLocale() == null || !"en".equals(v.getLocale().getLanguage())) continue;
                if (v.getFeatures() != null && v.getFeatures().contains(TextToSpeech.Engine.KEY_FEATURE_NOT_INSTALLED)) continue;
                out.add(v);
            }
        } catch (Exception ignored) {
            // Some engines throw before they are ready.
        }
        out.sort((a, b) -> Integer.compare(score(b), score(a)));
        return out;
    }

    /** Clear, natural voices first: Indian English, high quality, works offline. */
    private static int score(Voice v) {
        int s = v.getQuality() / 10;
        String c = v.getLocale().getCountry();
        if ("IN".equals(c)) s += 30;
        else if ("GB".equals(c)) s += 20;
        else if ("US".equals(c)) s += 15;
        if (v.isNetworkConnectionRequired()) s -= 12;
        return s;
    }

    private Voice bestVoice() {
        java.util.List<Voice> list = englishVoices();
        return list.isEmpty() ? null : list.get(0);
    }

    @PluginMethod
    public void voices(PluginCall call) {
        com.getcapacitor.JSArray arr = new com.getcapacitor.JSArray();
        if (tts != null && ttsReady) {
            for (Voice v : englishVoices()) {
                JSObject o = new JSObject();
                o.put("name", v.getName());
                o.put("locale", v.getLocale().toLanguageTag());
                o.put("quality", v.getQuality());
                o.put("network", v.isNetworkConnectionRequired());
                arr.put(o);
            }
        }
        JSObject result = new JSObject();
        result.put("voices", arr);
        call.resolve(result);
    }

    @PluginMethod
    public void speak(PluginCall call) {
        String text = call.getString("text", "");
        Double rate = call.getDouble("rate", 0.95);
        Double pitch = call.getDouble("pitch", 1.0);
        String voice = call.getString("voice");
        if (tts == null || !ttsReady || text == null || text.isEmpty()) {
            call.resolve();
            return;
        }
        if (voice != null && !voice.isEmpty() && (tts.getVoice() == null || !voice.equals(tts.getVoice().getName()))) {
            for (Voice v : englishVoices()) {
                if (v.getName().equals(voice)) {
                    tts.setVoice(v);
                    break;
                }
            }
        }
        tts.setSpeechRate(rate == null ? 0.95f : rate.floatValue());
        tts.setPitch(pitch == null ? 1.0f : pitch.floatValue());
        tts.speak(text, TextToSpeech.QUEUE_FLUSH, null, "q");
        call.resolve();
    }

    @PluginMethod
    public void stopSpeaking(PluginCall call) {
        if (tts != null) tts.stop();
        call.resolve();
    }

    // ── Reward photos: JPEGs in the app's private files folder ──

    private File photoFile(String id) {
        File dir = new File(getContext().getFilesDir(), "photos");
        if (!dir.exists()) dir.mkdirs();
        return new File(dir, id.replaceAll("[^A-Za-z0-9_-]", "_") + ".jpg");
    }

    @PluginMethod
    public void savePhoto(PluginCall call) {
        String id = call.getString("id");
        String dataUrl = call.getString("dataUrl");
        if (id == null || dataUrl == null || !dataUrl.contains(",")) {
            call.reject("id and dataUrl are required");
            return;
        }
        try (FileOutputStream out = new FileOutputStream(photoFile(id))) {
            out.write(Base64.decode(dataUrl.substring(dataUrl.indexOf(',') + 1), Base64.DEFAULT));
            call.resolve();
        } catch (Exception e) {
            call.reject("could not save photo");
        }
    }

    @PluginMethod
    public void loadPhoto(PluginCall call) {
        String id = call.getString("id");
        JSObject result = new JSObject();
        if (id != null) {
            File f = photoFile(id);
            if (f.exists()) {
                try (FileInputStream in = new FileInputStream(f)) {
                    byte[] bytes = new byte[(int) f.length()];
                    int read = 0;
                    while (read < bytes.length) {
                        int n = in.read(bytes, read, bytes.length - read);
                        if (n < 0) break;
                        read += n;
                    }
                    result.put("dataUrl", "data:image/jpeg;base64," + Base64.encodeToString(bytes, 0, read, Base64.NO_WRAP));
                } catch (Exception ignored) {
                    // No photo then.
                }
            }
        }
        call.resolve(result);
    }

    @PluginMethod
    public void deletePhoto(PluginCall call) {
        String id = call.getString("id");
        if (id != null) photoFile(id).delete();
        call.resolve();
    }

    private SharedPreferences prefs() {
        return getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }
}
