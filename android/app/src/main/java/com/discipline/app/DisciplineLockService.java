package com.discipline.app;

import android.accessibilityservice.AccessibilityService;
import android.view.accessibility.AccessibilityEvent;
import android.widget.Toast;

public class DisciplineLockService extends AccessibilityService {
  @Override
  public void onAccessibilityEvent(AccessibilityEvent event) {
    if (event.getEventType() != AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) return;
    if (!FocusLockPlugin.isActive(this)) return;
    CharSequence pkg = event.getPackageName();
    if (pkg == null) return;
    String current = pkg.toString();
    if (current.equals(getPackageName())) return;
    if (FocusLockPlugin.whitelist(this).contains(current)) return;
    performGlobalAction(GLOBAL_ACTION_HOME);
    Toast.makeText(this, "专注中：仅白名单应用可用", Toast.LENGTH_SHORT).show();
  }

  @Override
  public void onInterrupt() {}
}
