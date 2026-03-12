# Changelog

## 2026-03-11

- Removed all dark mode functionality from the app; ChronoFlip is now light-mode only.

## 2026-03-12

### Change 2: Segment-Based Color + Blocking Flash

**Scope:** `types.ts`, `usePersistence.ts`, `SegmentSettingsScreen.tsx`, `TimerRunningScreen.tsx`, `SegmentCard.tsx`, `EventCard.tsx`, `ViewerScreen.tsx`

**Summary:** Replaced time-based color alerts with a single background color per segment. Flash on completion is now a continuous blocking gate that prevents auto-advance until dismissed by user.

**Plan file:** `docs/plans/segment-color-blocking-flash.md`

**Details of changes:**

| File | What changed |
|------|--------------|
| `types.ts` | Removed `SpeechColorAlert` interface and `DEFAULT_COLOR_ALERTS`. Replaced `colorAlerts: SpeechColorAlert[]` with `color: string` on `Segment`. Added `isFlashing: boolean` to `TimerSyncState`. Updated `DEFAULT_SEGMENT` and `createDefaultSegment`. |
| `hooks/usePersistence.ts` | Removed `SpeechColorAlert` import. Added migration logic: derives `color` from `colorAlerts[0]?.color` for existing saved segments, defaults to `#3B82F6`. |
| `components/screens/SegmentSettingsScreen.tsx` | Removed `SpeechColorAlert` import, `colorAlerts` state, `addAlert`/`updateAlert`/`deleteAlert`/`formatAlertTime` functions, and entire Color Alerts UI section. Added `SEGMENT_COLORS` import, `color` state, and new Segment Color section with preset swatches + custom color picker. |
| `components/screens/TimerRunningScreen.tsx` | Removed `SpeechColorAlert` and `useMemo` imports, `activeAlertColor` state, `triggeredAlertIdsRef`, `sortedAlerts` memo, alert reset effect, and color alert checking effect. Added `isFlashBlocking` state, `flashIntervalRef`, `startBlockingFlash` (continuous 0.5s blink), `dismissFlash` (stops flash + advances), cleanup effect. Rewrote `handleSegmentComplete` to use blocking flash. Updated keyboard shortcuts (Space/Escape) for flash dismissal. Changed background color to use `currentSegment.color`. Updated button styling from `activeAlertColor` to `currentSegment?.color`. Updated `SegmentTransition` `toColor` prop. Updated Firebase sync state with `isFlashing`. Added flash blocking overlay with STOP button. |
| `components/ui/SegmentCard.tsx` | Left color strip now uses `segment.color` instead of `segment.colorAlerts[0]?.color`. |
| `components/ui/EventCard.tsx` | Bottom color strip now uses `seg.color ?? '#3B82F6'` instead of `seg.colorAlerts?.[0]?.color ?? '#3B82F6'`. |
| `components/screens/ViewerScreen.tsx` | Added `viewerFlashOn` state and flash animation effect to replicate organizer's blocking flash. Updated background color logic to flash between color and transparent when `isFlashing` is true. |

**Files intentionally NOT modified:**
- `config.ts` — has its own `ColorAlert` for legacy v1 timer, unrelated to speech segments
- `components/TimerSettings.tsx` — uses `colorAlerts` from `config.ts` (legacy v1), unrelated
- `App.tsx` — settings button already removed in prior change
