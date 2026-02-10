# ChronoFlip — Future Prospects

## 1. Push Notifications

**What**: Show system notification banners when timer alerts trigger or timer completes.

**Current status**: Not implemented.

**Platform support**:
| Scenario | Android PWA | iOS PWA (16.4+) | iOS Safari |
|---|---|---|---|
| Foreground (app open) | Yes | Yes | No |
| Background (app minimized) | Partially | Needs push server | No |
| Screen locked | No | No | No |

**Notes**:
- Foreground notifications are doable with zero server infrastructure (Notification API only)
- Background notifications on iOS require a push server (e.g., Firebase Cloud Messaging) — adds backend complexity
- iOS Safari (not added to home screen) has no notification support at all
- Most ChronoFlip users keep the app open during presentations, so foreground-only may be sufficient

---

## 2. Screen-Locked Behavior

**What**: Timer accuracy and alert sounds when the user locks their phone screen.

**Timer accuracy**: Works correctly on both platforms. ChronoFlip uses timestamp-based timing (`Date.now()`), so when the user unlocks the phone, the timer recalculates from the real clock and shows the correct remaining time. No drift.

**Alert sounds when locked**: Does NOT work on either platform.
- iOS freezes the PWA entirely — no JS executes, audio is blocked
- Android heavily throttles JS — intervals may not fire, audio playback is blocked
- Alerts that pass while the screen is locked are missed; alerts for the current time threshold fire when unlocked (range-based checking)

**Wake Lock API** (already implemented): Prevents the screen from auto-dimming/sleeping while the timer runs. Cannot prevent a manual screen lock by the user.

**This is a fundamental web platform limitation** — native apps can use background audio sessions and local notifications, but PWAs cannot.

---

## 3. Vibration Alerts

**What**: Vibrate the phone when timer alerts trigger (complement to audio alerts).

**Platform support**:
| Scenario | Android | iOS |
|---|---|---|
| Foreground | Yes | No (API not implemented by Apple) |
| Screen locked | No (JS frozen) | No |

**Notes**:
- Android-only, foreground-only feature
- Easy to implement: `navigator.vibrate([200, 100, 200])` alongside existing audio triggers
- Useful for presentations where the phone is face-down on a desk — vibration is more noticeable than sound
- Could be a toggleable setting alongside "Play alert sound"

---

## 4. Landscape Phone Layout (Pending Decision)

See `docs/landscape-phone-options.md` for the 4 proposed layout options (in Japanese).

**Problem**: On phones in landscape, auto-scaling makes everything fit but the UI is quite small.

**Current behavior**: Works — no scrolling, everything visible, just small on phone landscape. Tablets and desktop are unaffected.
