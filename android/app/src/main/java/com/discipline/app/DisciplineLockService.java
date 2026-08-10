package com.discipline.app;

import android.accessibilityservice.AccessibilityService;
import android.content.Intent;
import android.view.accessibility.AccessibilityEvent;
import android.widget.Toast;

public class DisciplineLockService extends AccessibilityService {
  private long lastBlockMs = 0;

  @Override
  public void onAccessibilityEvent(AccessibilityEvent event) {
    if (event.getEventType() != AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) return;
    if (!FocusLockPlugin.isActive(this)) return;
    CharSequence pkg = event.getPackageName();
    if (pkg == null) return;
    String current = pkg.toString();
    if (current.equals(getPackageName())) return;
    if (FocusLockPlugin.whitelist(this).contains(current)) return;
    long now = System.currentTimeMillis();
    if (now - lastBlockMs < 800) return; // debounce repeated window events
    lastBlockMs = now;
    bringBack();
    Toast.makeText(this, "专注中：仅白名单应用可用", Toast.LENGTH_SHORT).show();
  }

  private void bringBack() {
    try {
      Intent intent = new Intent(this, MainActivity.class);
      intent.addFlags(
          Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
      startActivity(intent);
    } catch (Exception e) {
      // Fallback: go home so the blocked app stays unusable.
      performGlobalAction(GLOBAL_ACTION_HOME);
    }
  }

  @Override
  public void onInterrupt() {}
}
