package com.studyhard.app;

import android.app.Activity;
import android.app.KeyguardManager;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.print.PdfMaker;
import android.print.PrintAttributes;
import android.print.PrintDocumentAdapter;
import android.print.PrintManager;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import androidx.core.content.FileProvider;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import android.provider.Settings;
import android.speech.tts.TextToSpeech;
import android.speech.tts.Voice;
import android.util.Base64;
import java.io.File;
import java.io.FileInputStream;
import java.io.InputStream;
import android.content.ComponentName;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.provider.OpenableColumns;
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
import androidx.core.app.NotificationManagerCompat;
import androidx.credentials.ClearCredentialStateRequest;
import androidx.credentials.Credential;
import androidx.credentials.CredentialManager;
import androidx.credentials.CredentialManagerCallback;
import androidx.credentials.CustomCredential;
import androidx.credentials.GetCredentialRequest;
import androidx.credentials.GetCredentialResponse;
import androidx.credentials.exceptions.ClearCredentialException;
import androidx.credentials.exceptions.GetCredentialCancellationException;
import androidx.credentials.exceptions.GetCredentialException;
import androidx.credentials.exceptions.NoCredentialException;
import com.google.android.libraries.identity.googleid.GetSignInWithGoogleOption;
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential;
import java.util.concurrent.Executors;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import androidx.activity.result.ActivityResult;
import java.util.Map;

/**
 * Study Hard's bridge to the phone: haptics, the back button, full-screen display,
 * the highest refresh rate, keep-screen-on while playing, a native mirror of the save
 * (progress survives even if the WebView's storage is cleared), reading questions
 * aloud with the phone's English voice, the reward photos parents attach, and the
 * reminders and home-screen widgets (Reminders.java, Widgets.java).
 * The web side lives in src/platform/native.ts.
 */
@CapacitorPlugin(
    name = "StudyHard",
    permissions = { @Permission(strings = { "android.permission.POST_NOTIFICATIONS" }, alias = "notifications") }
)
public class StudyHardPlugin extends Plugin {

    private static final String PREFS = "studyhard_save";
    private Vibrator vibrator;
    private TextToSpeech tts;
    private boolean ttsReady = false;
    /** A line asked for before the speech engine was ready; spoken as soon as it is. */
    private String pendingText = null;
    private String pendingVoice = null;
    private float pendingRate = 0.95f;
    /** "play" or "backup" when the app was opened from a reminder (read once by the web app). */
    private String pendingOpen = null;
    /** Files shared to MN (or opened with it): read off the main thread, collected once by the web app. */
    private SharedInbox inbox;
    private final java.util.concurrent.ExecutorService shareReader = java.util.concurrent.Executors.newSingleThreadExecutor();
    /** The launcher icons (activity-alias names in the manifest, added by scripts/android.mjs). */
    static final String[] ICONS = { "sky", "night", "sunset", "space", "gold" };

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
            if (ttsReady && pendingText != null) {
                speakNow(pendingText, pendingRate, 1.0f, pendingVoice);
                pendingText = null;
            }
        });

        AppCompatActivity activity = getActivity();
        Intent start = activity.getIntent();
        inbox = new SharedInbox(new SharedInbox.Files() {
            @Override
            public InputStream open(Uri uri) throws java.io.IOException {
                return getContext().getContentResolver().openInputStream(uri);
            }

            @Override
            public String name(Uri uri) {
                return displayName(uri);
            }

            @Override
            public boolean ours(String authority) {
                String me = getContext().getPackageName();
                if (authority.equals(me) || authority.startsWith(me + ".")) return true;
                android.content.pm.ProviderInfo p = getContext().getPackageManager().resolveContentProvider(authority, 0);
                return p != null && me.equals(p.packageName);
            }
        }, shareReader, () -> notifyListeners("shared", new JSObject(), true));
        inbox.take(start);
        // Reopened from Recents: Android hands back the original intent, already handled once.
        if (start != null && !SharedInbox.fromHistory(start) && start.hasExtra(Reminders.EXTRA_OPEN)) {
            pendingOpen = start.getStringExtra(Reminders.EXTRA_OPEN);
            start.removeExtra(Reminders.EXTRA_OPEN);
        }
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
        shareReader.shutdownNow();
        if (tts != null) {
            tts.stop();
            tts.shutdown();
            tts = null;
        }
        super.handleOnDestroy();
    }

    /** A reminder tapped while the app was already open. */
    @Override
    protected void handleOnNewIntent(Intent intent) {
        super.handleOnNewIntent(intent);
        if (inbox != null) inbox.take(intent);
        if (intent == null || SharedInbox.fromHistory(intent) || !intent.hasExtra(Reminders.EXTRA_OPEN)) return;
        pendingOpen = intent.getStringExtra(Reminders.EXTRA_OPEN);
        intent.removeExtra(Reminders.EXTRA_OPEN);
        JSObject d = new JSObject();
        d.put("open", pendingOpen);
        notifyListeners("launch", d);
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

    /** A stable id for this phone and app (survives reinstalling), for access keys. */
    /**
     * Sign in with Google (Credential Manager): the account sheet, then the Google ID token
     * for the Web client ID. Resolves { idToken, email, name } or { cancelled: true } or { error }.
     */
    @PluginMethod
    public void googleSignIn(PluginCall call) {
        String clientId = call.getString("webClientId", "");
        if (clientId == null || clientId.isEmpty()) {
            JSObject r = new JSObject();
            r.put("error", "no client id");
            call.resolve(r);
            return;
        }
        GetSignInWithGoogleOption option = new GetSignInWithGoogleOption.Builder(clientId).build();
        GetCredentialRequest request = new GetCredentialRequest.Builder().addCredentialOption(option).build();
        CredentialManager cm = CredentialManager.create(getContext());
        cm.getCredentialAsync(getActivity(), request, null, Executors.newSingleThreadExecutor(), new CredentialManagerCallback<GetCredentialResponse, GetCredentialException>() {
            @Override
            public void onResult(GetCredentialResponse response) {
                JSObject r = new JSObject();
                Credential c = response.getCredential();
                if (c instanceof CustomCredential && GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL.equals(c.getType())) {
                    try {
                        GoogleIdTokenCredential g = GoogleIdTokenCredential.createFrom(((CustomCredential) c).getData());
                        r.put("idToken", g.getIdToken());
                        r.put("email", g.getId());
                        r.put("name", g.getDisplayName() == null ? "" : g.getDisplayName());
                    } catch (Exception e) {
                        r.put("error", "bad credential");
                    }
                } else {
                    r.put("error", "unexpected credential");
                }
                call.resolve(r);
            }

            @Override
            public void onError(GetCredentialException e) {
                JSObject r = new JSObject();
                if (e instanceof GetCredentialCancellationException) r.put("cancelled", true);
                else if (e instanceof NoCredentialException) r.put("error", "no Google account on this phone");
                else r.put("error", e.getClass().getSimpleName() + ": " + e.getMessage());
                call.resolve(r);
            }
        });
    }

    // ── MN Plus purchases (Billing.java) ─────────────────────────────────────

    private Billing billing;

    private Billing billing() {
        if (billing == null) billing = new Billing(getContext(), (r) -> notifyListeners("purchases", r));
        return billing;
    }

    private static java.util.List<String> strings(com.getcapacitor.JSArray a) {
        java.util.List<String> out = new java.util.ArrayList<>();
        if (a == null) return out;
        try {
            for (int k = 0; k < a.length(); k++) out.add(a.getString(k));
        } catch (Exception ignored) {
        }
        return out;
    }

    /** The MN Plus products and their offers, with prices from Play. */
    @PluginMethod
    public void billingProducts(PluginCall call) {
        billing().products(strings(call.getArray("subs")), strings(call.getArray("inapp")), call::resolve);
    }

    /**
     * Open Play's purchase sheet for a product (and, for a subscription, one of its offers).
     * A change of plan passes the current subscription's token and Play's replacement mode;
     * `account` is an obfuscated id for the signed-in family.
     */
    @PluginMethod
    public void billingBuy(PluginCall call) {
        billing().buy(getActivity(), call.getString("product", ""), call.getString("offer", ""), call.getString("oldToken", ""), call.getInt("mode", 0), call.getString("account", ""), call::resolve);
    }

    /** What this Play account already owns. */
    @PluginMethod
    public void billingOwned(PluginCall call) {
        billing().owned(call::resolve);
    }

    /** Confirm a new purchase to Play. */
    @PluginMethod
    public void billingAck(PluginCall call) {
        billing().acknowledge(call.getString("token", ""), call::resolve);
    }

    /** Open a web page in the phone's browser (only after a parent check, in the web app). */
    @PluginMethod
    public void openUrl(PluginCall call) {
        String url = call.getString("url", "");
        if (!url.startsWith("https://")) {
            call.reject("https only");
            return;
        }
        Intent i = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        try {
            getContext().startActivity(i);
        } catch (Exception ignored) {
        }
        call.resolve();
    }

    /** The page being turned into a PDF (kept so it isn't collected half way). */
    private WebView pdfView;

    /**
     * Make a PDF from a page of HTML (A4, page breaks from its CSS) and open the share sheet
     * (WhatsApp, Drive, email, print…). If the PDF can't be made on this phone, the print
     * screen opens instead, where "Save as PDF" and printers are offered.
     */
    @PluginMethod
    public void sharePdf(final PluginCall call) {
        final String html = call.getString("html", "");
        final String name = call.getString("name", "MN.pdf").replaceAll("[^A-Za-z0-9._-]", "-");
        final String title = call.getString("title", "MN worksheet");
        final boolean landscape = Boolean.TRUE.equals(call.getBoolean("landscape", false));
        getActivity().runOnUiThread(() -> {
            final WebView wv = new WebView(getActivity());
            pdfView = wv;
            wv.getSettings().setJavaScriptEnabled(false);
            wv.setWebViewClient(new WebViewClient() {
                private boolean started = false;

                @Override
                public void onPageFinished(WebView view, String url) {
                    if (started) return;
                    started = true;
                    // Not view.postDelayed: this WebView is never on screen, and a detached view
                    // only runs posted work once it's attached (so it never would).
                    new android.os.Handler(android.os.Looper.getMainLooper()).postDelayed(() -> makePdf(call, view, name, title, landscape), 350);
                }
            });
            wv.loadDataWithBaseURL("https://localhost/", html, "text/html", "utf-8", null);
        });
    }

    private void makePdf(final PluginCall call, final WebView view, final String name, final String title, final boolean landscape) {
        try {
            File dir = new File(getContext().getCacheDir(), "share");
            if (!dir.exists() && !dir.mkdirs()) throw new java.io.IOException("no folder");
            final File out = new File(dir, name);
            PrintAttributes attrs = new PrintAttributes.Builder()
                    .setMediaSize(landscape ? PrintAttributes.MediaSize.ISO_A4.asLandscape() : PrintAttributes.MediaSize.ISO_A4)
                    .setResolution(new PrintAttributes.Resolution("pdf", "pdf", 300, 300))
                    .setMinMargins(PrintAttributes.Margins.NO_MARGINS)
                    .build();
            final PrintDocumentAdapter adapter = view.createPrintDocumentAdapter(title);
            PdfMaker.write(adapter, attrs, out, new PdfMaker.Done() {
                @Override
                public void ok(File file) {
                    getActivity().runOnUiThread(() -> {
                        pdfView = null;
                        shareFile(call, file, "application/pdf", title);
                    });
                }

                @Override
                public void fail(String why) {
                    getActivity().runOnUiThread(() -> printInstead(call, view, title, why));
                }
            });
        } catch (Throwable e) {
            printInstead(call, view, title, String.valueOf(e.getMessage()));
        }
    }

    /** The fallback: Android's print screen for the same page. */
    private void printInstead(PluginCall call, WebView view, String title, String why) {
        JSObject r = new JSObject();
        try {
            PrintManager pm = (PrintManager) getActivity().getSystemService(Context.PRINT_SERVICE);
            pm.print(title, view.createPrintDocumentAdapter(title), new PrintAttributes.Builder().setMediaSize(PrintAttributes.MediaSize.ISO_A4).build());
            r.put("ok", true);
            r.put("via", "print");
        } catch (Throwable e) {
            r.put("ok", false);
            r.put("error", why + " / " + e.getMessage());
        }
        // The print screen holds its own reference while it is open.
        new android.os.Handler(android.os.Looper.getMainLooper()).postDelayed(() -> pdfView = null, 60_000);
        call.resolve(r);
    }

    private void shareFile(PluginCall call, File file, String mime, String title) {
        JSObject r = new JSObject();
        try {
            Uri uri = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".fileprovider", file);
            Intent send = new Intent(Intent.ACTION_SEND);
            send.setType(mime);
            send.putExtra(Intent.EXTRA_STREAM, uri);
            send.putExtra(Intent.EXTRA_SUBJECT, title);
            send.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            Intent chooser = Intent.createChooser(send, title);
            chooser.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            getActivity().startActivity(chooser);
            r.put("ok", true);
            r.put("via", "share");
        } catch (Throwable e) {
            r.put("ok", false);
            r.put("error", String.valueOf(e.getMessage()));
        }
        call.resolve(r);
    }

    /** Play's page for managing (or cancelling) the subscription. */
    @PluginMethod
    public void billingManage(PluginCall call) {
        String sku = call.getString("product", "");
        Intent i = new Intent(Intent.ACTION_VIEW, Uri.parse("https://play.google.com/store/account/subscriptions?package=" + getContext().getPackageName() + (sku.isEmpty() ? "" : "&sku=" + sku)));
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        try {
            getContext().startActivity(i);
        } catch (Exception ignored) {
        }
        call.resolve();
    }

    /** Forget the chosen Google account on this phone (the next sign-in shows the account sheet). */
    @PluginMethod
    public void googleSignOut(PluginCall call) {
        CredentialManager cm = CredentialManager.create(getContext());
        cm.clearCredentialStateAsync(new ClearCredentialStateRequest(), null, Executors.newSingleThreadExecutor(), new CredentialManagerCallback<Void, ClearCredentialException>() {
            @Override
            public void onResult(Void v) {
                call.resolve();
            }

            @Override
            public void onError(ClearCredentialException e) {
                call.resolve();
            }
        });
    }

    @PluginMethod
    public void deviceId(PluginCall call) {
        // The shared APK: Android's id for this phone (its access keys are made for it).
        // The Play build has no access keys, so it uses a random id made once for this install
        // instead (it only names the phone in the family's backup).
        String id;
        if (PlayKey.PLAY) {
            SharedPreferences prefs = getContext().getSharedPreferences("studyhard.device", Context.MODE_PRIVATE);
            id = prefs.getString("id", null);
            if (id == null) {
                id = java.util.UUID.randomUUID().toString().replace("-", "");
                prefs.edit().putString("id", id).commit();
            }
        } else {
            id = Settings.Secure.getString(getContext().getContentResolver(), Settings.Secure.ANDROID_ID);
        }
        JSObject result = new JSObject();
        result.put("id", id == null ? "" : id);
        call.resolve(result);
    }

    /** Text waiting to be written once the parent picks where to save the file. */
    private String pendingFileText = null;

    /** Save a text file where the parent chooses (Downloads, Drive…). Resolves { saved }. */
    @PluginMethod
    public void saveFile(PluginCall call) {
        pendingFileText = call.getString("text", "");
        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType(call.getString("mime", "text/html"));
        intent.putExtra(Intent.EXTRA_TITLE, call.getString("name", "MN-report.html"));
        startActivityForResult(call, intent, "saveFileDone");
    }

    @ActivityCallback
    private void saveFileDone(PluginCall call, ActivityResult result) {
        if (call == null) return;
        JSObject r = new JSObject();
        Uri uri = result.getResultCode() == Activity.RESULT_OK && result.getData() != null ? result.getData().getData() : null;
        if (uri == null || pendingFileText == null) {
            r.put("saved", false);
        } else {
            try (OutputStream out = getContext().getContentResolver().openOutputStream(uri, "wt")) {
                if (out == null) throw new java.io.IOException("no stream");
                out.write(pendingFileText.getBytes(StandardCharsets.UTF_8));
                r.put("saved", true);
            } catch (Exception e) {
                r.put("saved", false);
                r.put("error", String.valueOf(e.getMessage()));
            }
        }
        pendingFileText = null;
        call.resolve(r);
    }

    /** Whether the phone has a screen lock (PIN, pattern, password or fingerprint). */
    @PluginMethod
    public void deviceSecure(PluginCall call) {
        KeyguardManager km = (KeyguardManager) getContext().getSystemService(Context.KEYGUARD_SERVICE);
        JSObject result = new JSObject();
        result.put("secure", km != null && km.isDeviceSecure());
        call.resolve(result);
    }

    /** The grown-up check: the phone's own screen lock. Resolves { ok } once it closes. */
    @PluginMethod
    @SuppressWarnings("deprecation")
    public void confirmDevice(PluginCall call) {
        KeyguardManager km = (KeyguardManager) getContext().getSystemService(Context.KEYGUARD_SERVICE);
        Intent intent = km == null ? null : km.createConfirmDeviceCredentialIntent(call.getString("title", "Grown-ups only"), call.getString("text", ""));
        if (intent == null) {
            JSObject result = new JSObject();
            result.put("ok", false);
            result.put("none", true);
            call.resolve(result);
            return;
        }
        startActivityForResult(call, intent, "confirmDeviceDone");
    }

    @ActivityCallback
    private void confirmDeviceDone(PluginCall call, ActivityResult result) {
        if (call == null) return;
        JSObject r = new JSObject();
        r.put("ok", result.getResultCode() == Activity.RESULT_OK);
        call.resolve(r);
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
        // commit(), not apply(): written to disk before this returns, so a level's result survives
        // the app being closed or killed straight after (apply() writes later, in the background).
        boolean ok = prefs().edit().putString(key, value).commit();
        JSObject result = new JSObject();
        result.put("ok", ok);
        call.resolve(result);
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
        if (tts == null || text == null || text.isEmpty()) {
            call.resolve();
            return;
        }
        if (!ttsReady) {
            // The engine is still starting (first question after launch): say it when ready.
            pendingText = text;
            pendingVoice = voice;
            pendingRate = rate == null ? 0.95f : rate.floatValue();
            call.resolve();
            return;
        }
        JSArray parts = call.getArray("parts");
        int gap = call.getInt("gap", 450);
        float r = rate == null ? 0.95f : rate.floatValue();
        float p = pitch == null ? 1.0f : pitch.floatValue();
        if (parts != null && parts.length() > 1) {
            // A lesson step: each line in turn, with a short quiet gap between them.
            speakNow(parts.optString(0, ""), r, p, voice);
            for (int i = 1; i < parts.length(); i++) {
                String line = parts.optString(i, "");
                if (line.isEmpty()) continue;
                tts.playSilentUtterance(Math.max(0, gap), TextToSpeech.QUEUE_ADD, "gap" + i);
                tts.speak(line, TextToSpeech.QUEUE_ADD, null, "q" + i);
            }
        } else {
            speakNow(text, r, p, voice);
        }
        call.resolve();
    }

    private void speakNow(String text, float rate, float pitch, String voice) {
        if (voice != null && !voice.isEmpty() && (tts.getVoice() == null || !voice.equals(tts.getVoice().getName()))) {
            for (Voice v : englishVoices()) {
                if (v.getName().equals(voice)) {
                    tts.setVoice(v);
                    break;
                }
            }
        }
        tts.setSpeechRate(rate);
        tts.setPitch(pitch);
        tts.speak(text, TextToSpeech.QUEUE_FLUSH, null, "q");
    }

    @PluginMethod
    public void stopSpeaking(PluginCall call) {
        pendingText = null;
        if (tts != null) tts.stop();
        call.resolve();
    }

    /** Still talking? (So a speech bubble stays until its words are finished.) */
    @PluginMethod
    public void speaking(PluginCall call) {
        JSObject r = new JSObject();
        r.put("speaking", tts != null && (tts.isSpeaking() || (!ttsReady && pendingText != null)));
        call.resolve(r);
    }

    // ── Reward photos: JPEGs in the app's private files folder ──

    private File photoDir() {
        return new File(getContext().getFilesDir(), "photos");
    }

    private File photoFile(String id) {
        File dir = photoDir();
        if (!dir.exists()) dir.mkdirs();
        return LocalData.photoFile(dir, id);
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

    /** The ids of the photos kept, so the app can delete the ones no reward uses any more. */
    @PluginMethod
    public void listPhotos(PluginCall call) {
        JSArray ids = new JSArray();
        for (String id : LocalData.photoIds(photoDir())) ids.put(id);
        JSObject r = new JSObject();
        r.put("ids", ids);
        call.resolve(r);
    }

    /**
     * "Delete account and data": everything MN keeps on the phone outside the save (the app
     * writes a fresh save itself). Every photo, every reminder and note, the widget data, and
     * the files made for sharing.
     */
    @PluginMethod
    public void wipeLocal(PluginCall call) {
        Context ctx = getContext();
        boolean ok = LocalData.deleteTree(photoDir());
        // An empty plan cancels every alarm set before; then the plan, snooze and widget data go.
        Reminders.apply(ctx, "{\"items\":[]}");
        Reminders.prefs(ctx).edit().clear().commit();
        NotificationManagerCompat.from(ctx).cancelAll();
        Widgets.updateAll(ctx);
        ok &= LocalData.deleteTree(new File(ctx.getCacheDir(), "share"));
        JSObject r = new JSObject();
        r.put("ok", ok);
        call.resolve(r);
    }

    private SharedPreferences prefs() {
        return getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    // ── reminders and widgets ──────────────────────────────────────────────

    /** A new plan from the web app: { plan: JSON text with items[] and widget{} }. */
    @PluginMethod
    public void setReminders(PluginCall call) {
        String plan = call.getString("plan");
        if (plan == null) {
            call.reject("no plan");
            return;
        }
        Context ctx = getContext();
        try {
            org.json.JSONObject parsed = new org.json.JSONObject(plan);
            org.json.JSONObject widget = parsed.optJSONObject("widget");
            Widgets.store(ctx, widget == null ? "{}" : widget.toString());
        } catch (Exception ignored) {
            // Keep the old widget data.
        }
        Reminders.apply(ctx, plan);
        Widgets.updateAll(ctx);
        call.resolve(notificationInfo());
    }

    /** How many MN widgets are on the home screen, and whether this launcher can add one for us. */
    @PluginMethod
    public void widgetState(PluginCall call) {
        Context ctx = getContext();
        android.appwidget.AppWidgetManager m = android.appwidget.AppWidgetManager.getInstance(ctx);
        int placed = 0;
        boolean canPin = false;
        if (m != null) {
            Class<?>[] kinds = { JarWidget.class, FactWidget.class, AdventureWidget.class, FocusWidget.class };
            for (Class<?> k : kinds) {
                int[] ids = m.getAppWidgetIds(new android.content.ComponentName(ctx, k));
                if (ids != null) placed += ids.length;
            }
            canPin = Build.VERSION.SDK_INT >= 26 && m.isRequestPinAppWidgetSupported();
        }
        JSObject r = new JSObject();
        r.put("placed", placed);
        r.put("canPin", canPin);
        call.resolve(r);
    }

    /** Ask the launcher to add one widget (it shows its own "Add to home screen" box). */
    @PluginMethod
    public void pinWidget(PluginCall call) {
        String kind = call.getString("kind", "today");
        Class<?> k = "focus".equals(kind) ? FocusWidget.class : "jar".equals(kind) ? JarWidget.class : "fact".equals(kind) ? FactWidget.class : AdventureWidget.class;
        Context ctx = getContext();
        boolean ok = false;
        try {
            android.appwidget.AppWidgetManager m = android.appwidget.AppWidgetManager.getInstance(ctx);
            if (m != null && Build.VERSION.SDK_INT >= 26 && m.isRequestPinAppWidgetSupported()) {
                ok = m.requestPinAppWidget(new android.content.ComponentName(ctx, k), null, null);
            }
        } catch (Exception ignored) {
            ok = false;
        }
        JSObject r = new JSObject();
        r.put("ok", ok);
        call.resolve(r);
    }

    private JSObject notificationInfo() {
        Context ctx = getContext();
        JSObject r = new JSObject();
        boolean ask = Build.VERSION.SDK_INT >= 33 && getPermissionState("notifications") != PermissionState.GRANTED;
        r.put("enabled", !ask && NotificationManagerCompat.from(ctx).areNotificationsEnabled());
        r.put("canAsk", ask && getPermissionState("notifications") != PermissionState.DENIED);
        r.put("snoozeUntil", Reminders.prefs(ctx).getLong(Reminders.KEY_SNOOZE, 0));
        return r;
    }

    /** Whether notes can be shown, and whether Android will still ask. */
    @PluginMethod
    public void notificationState(PluginCall call) {
        call.resolve(notificationInfo());
    }

    /** Ask Android for permission to show notes (Android 13 and later). */
    @PluginMethod
    public void askNotifications(PluginCall call) {
        if (Build.VERSION.SDK_INT < 33 || getPermissionState("notifications") == PermissionState.GRANTED) {
            call.resolve(notificationInfo());
            return;
        }
        requestPermissionForAlias("notifications", call, "notificationsAsked");
    }

    @PermissionCallback
    private void notificationsAsked(PluginCall call) {
        if (call == null) return;
        Reminders.createChannels(getContext());
        call.resolve(notificationInfo());
    }

    /** Opens the phone's notification settings for MN (after "Don't allow"). */
    @PluginMethod
    public void openNotificationSettings(PluginCall call) {
        try {
            Intent i = new Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS)
                .putExtra(Settings.EXTRA_APP_PACKAGE, getContext().getPackageName())
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(i);
        } catch (Exception e) {
            Intent i = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:" + getContext().getPackageName()))
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(i);
        }
        call.resolve();
    }

    /** The file shared to MN, once: { text, name } when it was read, { error } when it wasn't (SharedInbox). */
    @PluginMethod
    public void sharedFile(PluginCall call) {
        JSObject r = new JSObject();
        String[] f = inbox == null ? new String[3] : inbox.collect();
        if (f[0] != null) {
            r.put("text", f[0]);
            r.put("name", f[1] == null ? "" : f[1]);
        }
        if (f[2] != null) r.put("error", f[2]);
        call.resolve(r);
    }

    private String displayName(Uri uri) {
        try (Cursor c = getContext().getContentResolver().query(uri, new String[] { OpenableColumns.DISPLAY_NAME }, null, null, null)) {
            if (c != null && c.moveToFirst()) return c.getString(0);
        } catch (Exception ignored) {
            // No name: fine.
        }
        String last = uri.getLastPathSegment();
        return last == null ? "" : last;
    }

    /** Switch the launcher icon: enable one activity-alias, disable the others. */
    @PluginMethod
    public void setAppIcon(PluginCall call) {
        String want = call.getString("name", "sky");
        boolean known = false;
        for (String n : ICONS) if (n.equals(want)) known = true;
        if (!known) {
            call.reject("unknown icon");
            return;
        }
        try {
            PackageManager pm = getContext().getPackageManager();
            String pkg = getContext().getPackageName();
            // Turn the new one on first, so there is never a moment with no icon.
            pm.setComponentEnabledSetting(new ComponentName(pkg, ICON_NS + ".Icon" + cap(want)), PackageManager.COMPONENT_ENABLED_STATE_ENABLED, PackageManager.DONT_KILL_APP);
            for (String n : ICONS) {
                if (n.equals(want)) continue;
                pm.setComponentEnabledSetting(new ComponentName(pkg, ICON_NS + ".Icon" + cap(n)), PackageManager.COMPONENT_ENABLED_STATE_DISABLED, PackageManager.DONT_KILL_APP);
            }
            JSObject r = new JSObject();
            r.put("ok", true);
            call.resolve(r);
        } catch (Exception e) {
            JSObject r = new JSObject();
            r.put("ok", false);
            call.resolve(r);
        }
    }

    /** The icon aliases' class names are in the code's package, whatever the app's id. */
    private static final String ICON_NS = MainActivity.class.getPackage().getName();

    @PluginMethod
    public void appIcon(PluginCall call) {
        JSObject r = new JSObject();
        String now = "sky";
        try {
            PackageManager pm = getContext().getPackageManager();
            String pkg = getContext().getPackageName();
            for (String n : ICONS) {
                int st = pm.getComponentEnabledSetting(new ComponentName(pkg, ICON_NS + ".Icon" + cap(n)));
                if (st == PackageManager.COMPONENT_ENABLED_STATE_ENABLED) now = n;
            }
        } catch (Exception ignored) {
            // Default icon.
        }
        r.put("name", now);
        call.resolve(r);
    }

    private static String cap(String s) {
        return s.substring(0, 1).toUpperCase(Locale.ROOT) + s.substring(1);
    }

    @PluginMethod
    public void launchAction(PluginCall call) {
        JSObject r = new JSObject();
        r.put("open", pendingOpen == null ? "" : pendingOpen);
        pendingOpen = null;
        call.resolve(r);
    }
}
