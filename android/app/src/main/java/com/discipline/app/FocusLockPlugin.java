package com.discipline.app;

import android.content.Context;
import android.content.SharedPreferences;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

@CapacitorPlugin(name = "FocusLock")
public class FocusLockPlugin extends Plugin {
  private static final String PREFS = "focus_lock";
  private static final String KEY_ACTIVE = "active";
  private static final String KEY_WHITELIST = "whitelist";

  private SharedPreferences prefs() {
    return getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
  }

  @PluginMethod
  public void listApps(PluginCall call) {
    try {
      PackageManager pm = getContext().getPackageManager();
      List<ApplicationInfo> apps = pm.getInstalledApplications(0);
      JSArray out = new JSArray();
      for (ApplicationInfo ai : apps) {
        JSObject o = new JSObject();
        o.put("id", ai.packageName);
        CharSequence label = ai.loadLabel(pm);
        o.put("name", label != null ? label.toString() : ai.packageName);
        out.put(o);
      }
      JSObject result = new JSObject();
      result.put("apps", out);
      call.resolve(result);
    } catch (Exception e) {
      call.reject(e.getMessage());
    }
  }

  @PluginMethod
  public void setFocusActive(PluginCall call) {
    boolean active = call.getBoolean("active", false);
    prefs().edit().putBoolean(KEY_ACTIVE, active).apply();
    call.resolve();
  }

  @PluginMethod
  public void setWhitelist(PluginCall call) {
    JSArray arr = call.getArray("packages");
    Set<String> set = new HashSet<>();
    if (arr != null) {
      for (int i = 0; i < arr.length(); i++) {
        String p = arr.getString(i);
        if (p != null) set.add(p);
      }
    }
    prefs().edit().putStringSet(KEY_WHITELIST, set).apply();
    call.resolve();
  }

  public static boolean isActive(Context context) {
    return context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getBoolean(KEY_ACTIVE, false);
  }

  public static Set<String> whitelist(Context context) {
    return context
        .getSharedPreferences(PREFS, Context.MODE_PRIVATE)
        .getStringSet(KEY_WHITELIST, new HashSet<String>());
  }
}
