package com.randybejerano.save305;

import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.graphics.Typeface;
import android.net.Uri;
import android.os.Bundle;
import android.os.SystemClock;
import android.text.InputType;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.CookieManager;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;

import androidx.biometric.BiometricManager;
import androidx.biometric.BiometricPrompt;
import androidx.fragment.app.FragmentActivity;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.concurrent.Executor;

public class MainActivity extends FragmentActivity {
    private static final String APP_URL = "https://randyraulbr1.github.io/Cuentas/?app=android";
    private static final String PREFS = "save305_secure_local";
    private static final String KEY_PIN = "pin_hash_v1";
    private static final String KEY_BIOMETRIC = "biometric_enabled";
    private static final String KEY_ATTEMPTS = "failed_attempts";
    private static final String KEY_LOCK_UNTIL = "locked_until";
    private static final int GREEN = Color.rgb(28, 199, 114);
    private static final int BG = Color.rgb(8, 10, 15);
    private static final int CARD = Color.rgb(20, 24, 31);
    private static final int MUTED = Color.rgb(159, 169, 183);

    private FrameLayout root;
    private WebView webView;
    private SharedPreferences prefs;
    private String entered = "";
    private String firstPin = null;
    private TextView dots;
    private TextView title;
    private TextView subtitle;
    private Button primaryButton;
    private boolean unlocked = false;
    private boolean biometricPromptShowing = false;

    @Override protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().setStatusBarColor(BG);
        getWindow().setNavigationBarColor(BG);
        prefs = getSharedPreferences(PREFS, MODE_PRIVATE);
        root = new FrameLayout(this);
        root.setBackgroundColor(BG);
        setContentView(root);

        if (!hasPin()) showPinSetup();
        else {
            showUnlock();
            root.postDelayed(this::tryBiometricAutomatically, 250);
        }
    }

    private boolean hasPin() {
        return !prefs.getString(KEY_PIN, "").isEmpty();
    }

    private boolean biometricsAvailable() {
        int authenticators = BiometricManager.Authenticators.BIOMETRIC_STRONG |
            BiometricManager.Authenticators.BIOMETRIC_WEAK;
        return BiometricManager.from(this).canAuthenticate(authenticators) ==
            BiometricManager.BIOMETRIC_SUCCESS;
    }

    private void showPinSetup() {
        firstPin = null;
        entered = "";
        buildKeypad("Protege tu dinero", "Crea un PIN de 6 números", "Continuar", false);
    }

    private void showUnlock() {
        firstPin = null;
        entered = "";
        buildKeypad("Bienvenido", "Desbloquea 305 Save", "Entrar", true);
    }

    private void buildKeypad(String heading, String message, String buttonText, boolean unlockMode) {
        root.removeAllViews();
        android.widget.ScrollView scroll = new android.widget.ScrollView(this);
        scroll.setFillViewport(true);
        FrameLayout.LayoutParams scrollLp = new FrameLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT);
        root.addView(scroll, scrollLp);

        LinearLayout page = new LinearLayout(this);
        page.setOrientation(LinearLayout.VERTICAL);
        page.setGravity(Gravity.CENTER_HORIZONTAL);
        page.setPadding(dp(24), dp(30), dp(24), dp(22));
        scroll.addView(page, new android.widget.ScrollView.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));

        TextView logo = new TextView(this);
        logo.setText("$");
        logo.setTextColor(Color.WHITE);
        logo.setTextSize(34);
        logo.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        logo.setGravity(Gravity.CENTER);
        android.graphics.drawable.GradientDrawable logoBg = rounded(BG, dp(22));
        logoBg.setStroke(dp(2), GREEN);
        logo.setBackground(logoBg);
        page.addView(logo, linear(dp(82), dp(82), 0, 0, 0, dp(22)));

        title = label(heading, 30, Color.WHITE, true);
        page.addView(title, linear(-1, -2, 0, 0, 0, dp(7)));
        subtitle = label(message, 16, MUTED, false);
        subtitle.setGravity(Gravity.CENTER);
        page.addView(subtitle, linear(-1, -2, 0, 0, 0, dp(24)));

        dots = label("○  ○  ○  ○  ○  ○", 31, Color.WHITE, true);
        dots.setGravity(Gravity.CENTER);
        dots.setLetterSpacing(0.08f);
        dots.setBackground(rounded(CARD, dp(18)));
        page.addView(dots, linear(-1, dp(76), 0, 0, 0, dp(20)));

        LinearLayout keypad = new LinearLayout(this);
        keypad.setOrientation(LinearLayout.VERTICAL);
        for (int row = 0; row < 3; row++) {
            LinearLayout line = new LinearLayout(this);
            line.setOrientation(LinearLayout.HORIZONTAL);
            for (int col = 0; col < 3; col++) {
                int number = row * 3 + col + 1;
                line.addView(numberButton(String.valueOf(number)), weightButton());
            }
            keypad.addView(line, linear(-1, dp(64), 0, 0, 0, dp(8)));
        }
        LinearLayout last = new LinearLayout(this);
        last.setOrientation(LinearLayout.HORIZONTAL);
        View spacer = new View(this);
        last.addView(spacer, weightButton());
        last.addView(numberButton("0"), weightButton());
        Button erase = numberButton("⌫");
        erase.setContentDescription("Borrar");
        erase.setOnClickListener(v -> eraseDigit());
        last.addView(erase, weightButton());
        keypad.addView(last, linear(-1, dp(64), 0, 0, 0, dp(14)));
        page.addView(keypad, linear(-1, -2, 0, 0, 0, 0));

        primaryButton = new Button(this);
        primaryButton.setText(buttonText);
        primaryButton.setTextColor(Color.rgb(5, 25, 17));
        primaryButton.setTextSize(17);
        primaryButton.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        primaryButton.setAllCaps(false);
        primaryButton.setEnabled(false);
        primaryButton.setAlpha(.45f);
        primaryButton.setBackground(rounded(GREEN, dp(16)));
        primaryButton.setOnClickListener(v -> {
            if (unlockMode) checkPin();
            else continueSetup();
        });
        page.addView(primaryButton, linear(-1, dp(58), 0, 0, 0, dp(14)));

        if (unlockMode && biometricsAvailable()) {
            boolean bioEnabled = prefs.getBoolean(KEY_BIOMETRIC, false);
            Button bio = new Button(this);
            bio.setText(bioEnabled ? "Usar huella o rostro" : "Activar huella o rostro");
            bio.setTextColor(Color.WHITE);
            bio.setTextSize(15);
            bio.setAllCaps(false);
            android.graphics.drawable.GradientDrawable bioBg = rounded(CARD, dp(15));
            bioBg.setStroke(dp(1), Color.rgb(52, 61, 74));
            bio.setBackground(bioBg);
            bio.setOnClickListener(v -> showBiometric(!bioEnabled, false));
            page.addView(bio, linear(-1, dp(54), 0, 0, 0, 0));
        }
    }

    private Button numberButton(String value) {
        Button button = new Button(this);
        button.setText(value);
        button.setTextColor(Color.WHITE);
        button.setTextSize(23);
        button.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        button.setAllCaps(false);
        button.setBackground(rounded(CARD, dp(17)));
        button.setOnClickListener(v -> addDigit(value));
        LinearLayout.LayoutParams lp = weightButton();
        lp.setMargins(dp(4), 0, dp(4), 0);
        button.setLayoutParams(lp);
        return button;
    }

    private void addDigit(String digit) {
        if (entered.length() >= 6 || !digit.matches("\\d")) return;
        entered += digit;
        updateDots();
    }

    private void eraseDigit() {
        if (!entered.isEmpty()) entered = entered.substring(0, entered.length() - 1);
        updateDots();
        subtitle.setText(firstPin == null ? (hasPin() ? "Desbloquea 305 Save" : "Crea un PIN de 6 números") : "Confirma el mismo PIN");
        subtitle.setTextColor(MUTED);
    }

    private void updateDots() {
        StringBuilder value = new StringBuilder();
        for (int i = 0; i < 6; i++) {
            if (i > 0) value.append("  ");
            value.append(i < entered.length() ? "●" : "○");
        }
        dots.setText(value.toString());
        boolean ready = entered.length() == 6;
        primaryButton.setEnabled(ready);
        primaryButton.setAlpha(ready ? 1f : .45f);
    }

    private void continueSetup() {
        if (entered.length() != 6) return;
        if (firstPin == null) {
            firstPin = entered;
            entered = "";
            title.setText("Confirma tu PIN");
            subtitle.setText("Escríbelo nuevamente");
            primaryButton.setText("Guardar y entrar");
            updateDots();
            return;
        }
        if (!firstPin.equals(entered)) {
            entered = "";
            firstPin = null;
            title.setText("Protege tu dinero");
            subtitle.setText("Los PIN no coinciden. Comienza otra vez.");
            subtitle.setTextColor(Color.rgb(255, 100, 112));
            primaryButton.setText("Continuar");
            updateDots();
            return;
        }
        prefs.edit().putString(KEY_PIN, sha256(entered))
            .putInt(KEY_ATTEMPTS, 0).remove(KEY_LOCK_UNTIL).apply();
        entered = "";
        if (biometricsAvailable()) showBiometric(true, true);
        else openApp();
    }

    private void checkPin() {
        long lockUntil = prefs.getLong(KEY_LOCK_UNTIL, 0);
        if (lockUntil > System.currentTimeMillis()) {
            long seconds = (lockUntil - System.currentTimeMillis() + 999) / 1000;
            subtitle.setText("Espera " + (seconds / 60) + ":" + String.format("%02d", seconds % 60));
            subtitle.setTextColor(Color.rgb(255, 100, 112));
            return;
        }
        if (sha256(entered).equals(prefs.getString(KEY_PIN, ""))) {
            prefs.edit().putInt(KEY_ATTEMPTS, 0).remove(KEY_LOCK_UNTIL).apply();
            openApp();
            return;
        }
        int attempts = prefs.getInt(KEY_ATTEMPTS, 0) + 1;
        SharedPreferences.Editor edit = prefs.edit().putInt(KEY_ATTEMPTS, attempts);
        if (attempts >= 3) {
            edit.putInt(KEY_ATTEMPTS, 0)
                .putLong(KEY_LOCK_UNTIL, System.currentTimeMillis() + 5 * 60 * 1000L);
            subtitle.setText("3 intentos incorrectos. Espera 5 minutos.");
        } else subtitle.setText("PIN incorrecto. Quedan " + (3 - attempts) + " intentos.");
        edit.apply();
        subtitle.setTextColor(Color.rgb(255, 100, 112));
        entered = "";
        updateDots();
    }

    private void tryBiometricAutomatically() {
        if (!unlocked && hasPin() && biometricsAvailable() &&
            prefs.getBoolean(KEY_BIOMETRIC, false)) showBiometric(false, false);
    }

    private void showBiometric(boolean firstSetup, boolean autoOpenOnDecline) {
        if (biometricPromptShowing || unlocked) return;
        biometricPromptShowing = true;
        int authenticators = BiometricManager.Authenticators.BIOMETRIC_STRONG |
            BiometricManager.Authenticators.BIOMETRIC_WEAK;
        Executor executor = getMainExecutor();
        BiometricPrompt prompt = new BiometricPrompt(this, executor,
            new BiometricPrompt.AuthenticationCallback() {
                @Override public void onAuthenticationSucceeded(
                    BiometricPrompt.AuthenticationResult result) {
                    super.onAuthenticationSucceeded(result);
                    biometricPromptShowing = false;
                    prefs.edit().putBoolean(KEY_BIOMETRIC, true).apply();
                    openApp();
                }
                @Override public void onAuthenticationError(int code, CharSequence message) {
                    super.onAuthenticationError(code, message);
                    biometricPromptShowing = false;
                    if (firstSetup) prefs.edit().putBoolean(KEY_BIOMETRIC, false).apply();
                    if (autoOpenOnDecline) {
                        openApp();
                    } else {
                        subtitle.setText("Usa tu PIN para entrar");
                        subtitle.setTextColor(MUTED);
                    }
                }
                @Override public void onAuthenticationFailed() {
                    super.onAuthenticationFailed();
                    subtitle.setText("No se reconoció. Inténtalo otra vez.");
                    subtitle.setTextColor(Color.rgb(255, 100, 112));
                }
            });
        BiometricPrompt.PromptInfo info = new BiometricPrompt.PromptInfo.Builder()
            .setTitle(firstSetup ? "Activa el acceso rápido" : "Desbloquea 305 Save")
            .setSubtitle("Usa la huella o el rostro configurado en tu teléfono")
            .setNegativeButtonText(firstSetup ? "Ahora no" : "Usar PIN")
            .setAllowedAuthenticators(authenticators)
            .build();
        prompt.authenticate(info);
    }

    private void openApp() {
        if (unlocked) return;
        unlocked = true;
        biometricPromptShowing = false;
        root.removeAllViews();
        configureWebView();
        root.addView(webView, new FrameLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        webView.loadUrl(APP_URL);
    }

    private void configureWebView() {
        webView = new WebView(this);
        webView.setBackgroundColor(BG);
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);
        settings.setSupportZoom(false);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        settings.setSupportMultipleWindows(true);
        settings.setJavaScriptCanOpenWindowsAutomatically(true);
        settings.setMediaPlaybackRequiresUserGesture(true);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setUserAgentString(settings.getUserAgentString() + " 305SaveAndroid/0.2");

        CookieManager cookies = CookieManager.getInstance();
        cookies.setAcceptCookie(true);
        cookies.setAcceptThirdPartyCookies(webView, true);
        webView.setWebChromeClient(new WebChromeClient() {
            @Override public boolean onCreateWindow(WebView view, boolean isDialog,
                    boolean isUserGesture, android.os.Message resultMsg) {
                WebView popup = new WebView(MainActivity.this);
                WebSettings popupSettings = popup.getSettings();
                popupSettings.setJavaScriptEnabled(true);
                popupSettings.setDomStorageEnabled(true);
                popupSettings.setSupportMultipleWindows(true);
                popupSettings.setJavaScriptCanOpenWindowsAutomatically(true);
                CookieManager.getInstance().setAcceptThirdPartyCookies(popup, true);

                android.app.Dialog dialog = new android.app.Dialog(MainActivity.this,
                    android.R.style.Theme_Black_NoTitleBar_Fullscreen);
                FrameLayout popupRoot = new FrameLayout(MainActivity.this);
                popupRoot.setBackgroundColor(BG);
                Button closeBtn = new Button(MainActivity.this);
                closeBtn.setText("\u2715");
                closeBtn.setTextColor(Color.WHITE);
                closeBtn.setBackground(rounded(CARD, dp(20)));
                closeBtn.setOnClickListener(v -> dialog.dismiss());
                FrameLayout.LayoutParams webLp = new FrameLayout.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT);
                webLp.topMargin = dp(48);
                popupRoot.addView(popup, webLp);
                FrameLayout.LayoutParams closeLp = new FrameLayout.LayoutParams(dp(40), dp(40));
                closeLp.gravity = Gravity.TOP | Gravity.END;
                closeLp.topMargin = dp(4);
                closeLp.rightMargin = dp(8);
                popupRoot.addView(closeBtn, closeLp);
                dialog.setContentView(popupRoot);
                dialog.setOnDismissListener(d -> popup.destroy());

                popup.setWebViewClient(new WebViewClient() {
                    @Override public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest request) {
                        Uri uri = request.getUrl();
                        String host = uri.getHost() == null ? "" : uri.getHost();
                        if (host.endsWith("github.io")) {
                            dialog.dismiss();
                            webView.loadUrl(uri.toString());
                            return true;
                        }
                        String scheme = uri.getScheme();
                        if (!"https".equalsIgnoreCase(scheme) && !"http".equalsIgnoreCase(scheme)) {
                            try { startActivity(new Intent(Intent.ACTION_VIEW, uri)); } catch (Exception ignored) {}
                            return true;
                        }
                        return false;
                    }
                });
                popup.setWebChromeClient(new WebChromeClient());

                WebView.WebViewTransport transport = (WebView.WebViewTransport) resultMsg.obj;
                transport.setWebView(popup);
                resultMsg.sendToTarget();
                dialog.show();
                return true;
            }
        });
        webView.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                String scheme = uri.getScheme();
                if ("https".equalsIgnoreCase(scheme) || "http".equalsIgnoreCase(scheme)) return false;
                try { startActivity(new Intent(Intent.ACTION_VIEW, uri)); } catch (Exception ignored) {}
                return true;
            }
            @Override public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request.isForMainFrame()) view.loadDataWithBaseURL(null,
                    "<html><body style='background:#080a0f;color:#fff;font-family:sans-serif;padding:32px;text-align:center'>" +
                    "<h2>305 Save</h2><p>No hay conexión. Revisa el internet y vuelve a abrir la app.</p>" +
                    "<button onclick=\"location.href='" + APP_URL + "'\" style='padding:14px 22px;border:0;border-radius:12px'>Reintentar</button>" +
                    "</body></html>", "text/html", "UTF-8", null);
            }
        });
    }

    private String sha256(String value) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] bytes = digest.digest(("305-save-native-pin:" + value).getBytes(StandardCharsets.UTF_8));
            StringBuilder out = new StringBuilder();
            for (byte b : bytes) out.append(String.format("%02x", b));
            return out.toString();
        } catch (Exception error) {
            return "";
        }
    }

    private TextView label(String text, int size, int color, boolean bold) {
        TextView view = new TextView(this);
        view.setText(text);
        view.setTextSize(size);
        view.setTextColor(color);
        view.setGravity(Gravity.CENTER);
        if (bold) view.setTypeface(Typeface.DEFAULT, Typeface.BOLD);
        return view;
    }

    private android.graphics.drawable.GradientDrawable rounded(int color, int radius) {
        android.graphics.drawable.GradientDrawable drawable = new android.graphics.drawable.GradientDrawable();
        drawable.setColor(color);
        drawable.setCornerRadius(radius);
        return drawable;
    }

    private LinearLayout.LayoutParams linear(int width, int height, int l, int t, int r, int b) {
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(width, height);
        lp.setMargins(dp(l), dp(t), dp(r), dp(b));
        return lp;
    }

    private LinearLayout.LayoutParams weightButton() {
        return new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.MATCH_PARENT, 1f);
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }

    @Override public void onBackPressed() {
        if (unlocked && webView != null && webView.canGoBack()) webView.goBack();
        else if (unlocked) super.onBackPressed();
    }

    @Override protected void onResume() {
        super.onResume();
        if (webView != null) { webView.onResume(); webView.resumeTimers(); }
    }

    @Override protected void onPause() {
        if (webView != null) { webView.onPause(); webView.pauseTimers(); }
        super.onPause();
    }

    @Override protected void onDestroy() {
        if (webView != null) { webView.loadUrl("about:blank"); webView.destroy(); }
        super.onDestroy();
    }
}
