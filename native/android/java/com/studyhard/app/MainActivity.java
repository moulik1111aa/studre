package com.studyhard.app;

import android.os.Build;
import android.os.Bundle;
import android.webkit.WebSettings;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    @SuppressWarnings("deprecation")
    public void onCreate(Bundle savedInstanceState) {
        // The app's own plugin must be registered before the bridge starts.
        registerPlugin(StudyHardPlugin.class);
        super.onCreate(savedInstanceState);
        // The app has its own dark and light looks: stop the phone from darkening the page
        // on top of them (forced dark mode made text white on white on some phones).
        try {
            WebView web = getBridge() != null ? getBridge().getWebView() : null;
            if (web != null) {
                WebSettings s = web.getSettings();
                if (Build.VERSION.SDK_INT >= 33) s.setAlgorithmicDarkeningAllowed(false);
                else if (Build.VERSION.SDK_INT >= 29) s.setForceDark(WebSettings.FORCE_DARK_OFF);
            }
        } catch (Exception ignored) {
            // Older WebViews: nothing to switch off.
        }
    }
}
