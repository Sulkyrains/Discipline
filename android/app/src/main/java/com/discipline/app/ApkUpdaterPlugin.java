package com.discipline.app;

import android.content.Intent;
import android.net.Uri;

import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;

/**
 * In-app APK updater: downloads the release APK into the app's external files
 * directory and opens the system package installer via FileProvider. Android
 * always shows a user confirmation for sideloaded installs.
 */
@CapacitorPlugin(name = "ApkUpdater")
public class ApkUpdaterPlugin extends Plugin {
  private static final String FILE_NAME = "Discipline-update.apk";

  private File targetFile() {
    File dir = getContext().getExternalFilesDir(null);
    if (dir == null) dir = getContext().getFilesDir();
    return new File(dir, FILE_NAME);
  }

  @PluginMethod
  public void download(PluginCall call) {
    String url = call.getString("url");
    if (url == null || url.isEmpty()) {
      call.reject("url required");
      return;
    }
    new Thread(
            () -> {
              try {
                HttpURLConnection conn = (HttpURLConnection) new URL(url).openConnection();
                conn.setConnectTimeout(20000);
                conn.setReadTimeout(120000);
                conn.setInstanceFollowRedirects(true);
                conn.connect();
                int code = conn.getResponseCode();
                if (code < 200 || code >= 300) {
                  call.reject("download failed: " + code);
                  return;
                }
                File target = targetFile();
                try (InputStream in = conn.getInputStream();
                    FileOutputStream out = new FileOutputStream(target)) {
                  byte[] buf = new byte[8192];
                  int n;
                  while ((n = in.read(buf)) != -1) out.write(buf, 0, n);
                }
                JSObject result = new JSObject();
                result.put("path", target.getAbsolutePath());
                call.resolve(result);
              } catch (Exception e) {
                call.reject(e.getMessage());
              }
            })
        .start();
  }

  @PluginMethod
  public void install(PluginCall call) {
    File apk = targetFile();
    if (!apk.exists()) {
      call.reject("apk not downloaded");
      return;
    }
    Uri uri =
        FileProvider.getUriForFile(
            getContext(), getContext().getPackageName() + ".fileprovider", apk);
    Intent intent = new Intent(Intent.ACTION_VIEW);
    intent.setDataAndType(uri, "application/vnd.android.package-archive");
    intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
    try {
      getContext().startActivity(intent);
      call.resolve();
    } catch (Exception e) {
      call.reject(e.getMessage());
    }
  }
}
