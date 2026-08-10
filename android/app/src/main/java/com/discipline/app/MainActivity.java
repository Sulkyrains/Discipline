package com.discipline.app;

import android.os.Bundle;
import android.webkit.WebSettings;
import android.webkit.WebView;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
  @Override
  public void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);
    registerPlugin(FocusLockPlugin.class);
    registerPlugin(ApkUpdaterPlugin.class);
    // WebView hardening: no file/content access, no mixed content, no
    // file-scheme script access. The app only talks to HTTPS endpoints.
    WebView webView = getBridge().getWebView();
    WebSettings settings = webView.getSettings();
    settings.setAllowFileAccess(false);
    settings.setAllowContentAccess(false);
    settings.setAllowFileAccessFromFileURLs(false);
    settings.setAllowUniversalAccessFromFileURLs(false);
    settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
  }
}
