package com.tradelog.pro;

import android.app.Activity;
import android.graphics.Color;
import android.os.Build;
import android.view.View;
import android.view.ViewGroup;
import android.view.Window;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Edge-to-edge handling for Capacitor 6.
 *
 * Android 15+ (targetSdk 35+) always draws apps behind the status bar, the
 * navigation bar and the keyboard. Capacitor 6 leaves that to the WebView, which
 * gets it wrong around the keyboard (sheets slid under the status bar) and the
 * splash screen reset the status bar icons to white on a white app.
 *
 * Here the WebView is kept inside the system bars (and above the keyboard) with
 * margins, the bar areas are painted with the app's top/bottom bar colour, and
 * the icon colour follows the theme. JS calls SystemBars.setStyle on every theme
 * change; env(safe-area-inset-*) is then 0 in the app, so the CSS adds nothing.
 */
@CapacitorPlugin(name = "SystemBars")
public class SystemBarsPlugin extends Plugin {
    private static int color = 0xFF0C0F1A; // dark theme --bg2, matches the splash
    private static boolean lightBg = false;

    static void install(final Activity activity, final View webView) {
        Window window = activity.getWindow();
        WindowCompat.setDecorFitsSystemWindows(window, false); // same layout on every Android version
        window.setStatusBarColor(Color.TRANSPARENT);
        window.setNavigationBarColor(Color.TRANSPARENT);
        if (Build.VERSION.SDK_INT >= 29) {
            window.setStatusBarContrastEnforced(false);
            window.setNavigationBarContrastEnforced(false); // no grey scrim behind the 3-button bar
        }
        ViewCompat.setOnApplyWindowInsetsListener(webView, (v, insets) -> {
            Insets bars = insets.getInsets(WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout());
            Insets ime = insets.getInsets(WindowInsetsCompat.Type.ime());
            ViewGroup.MarginLayoutParams lp = (ViewGroup.MarginLayoutParams) v.getLayoutParams();
            lp.topMargin = bars.top;
            lp.leftMargin = bars.left;
            lp.rightMargin = bars.right;
            lp.bottomMargin = Math.max(bars.bottom, ime.bottom);
            v.setLayoutParams(lp);
            return WindowInsetsCompat.CONSUMED;
        });
        paint(activity, webView);
    }

    private static void paint(Activity activity, View webView) {
        Window window = activity.getWindow();
        View parent = (View) webView.getParent();
        if (parent != null) parent.setBackgroundColor(color);
        window.getDecorView().setBackgroundColor(color);
        WindowInsetsControllerCompat c = WindowCompat.getInsetsController(window, window.getDecorView());
        c.setAppearanceLightStatusBars(lightBg);
        c.setAppearanceLightNavigationBars(lightBg);
    }

    @PluginMethod
    public void setStyle(final PluginCall call) {
        String hex = call.getString("color", "#0c0f1a");
        try {
            color = Color.parseColor(hex);
        } catch (IllegalArgumentException e) {
            call.reject("Bad color: " + hex);
            return;
        }
        lightBg = Boolean.TRUE.equals(call.getBoolean("light", false));
        getActivity().runOnUiThread(() -> {
            paint(getActivity(), getBridge().getWebView());
            call.resolve();
        });
    }
}
