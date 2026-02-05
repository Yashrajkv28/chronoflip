# ChronoFlip - Project Documentation

## Overview

**ChronoFlip** is a premium flip clock timer web application built with React and TypeScript. It features elegant 3D flip animations, customizable color-based alerts, multiple timer modes, and a glassmorphic UI design.

## Tech Stack

- **Language:** TypeScript 5.8.2
- **Framework:** React 19.2.4
- **Build Tool:** Vite 6.2.0
- **Styling:** Tailwind CSS (CDN)
- **Audio:** Web Audio API (synthesized sounds, no external files)

## Project Structure

```
chronoflip/
├── App.tsx                    # Root component, dark mode management
├── index.tsx                  # Entry point (ReactDOM.createRoot)
├── index.html                 # HTML template with Tailwind config & animations
├── vite.config.ts             # Vite configuration
├── tsconfig.json              # TypeScript configuration
├── package.json               # Dependencies
├── metadata.json              # App metadata
├── README.md                  # User documentation
├── claude.md                  # Developer documentation (this file)
│
├── components/
│   ├── FlipClockTimer.tsx     # Main timer logic, state, controls (~420 lines)
│   ├── FlipClockDisplay.tsx   # Digit layout and separators (~90 lines)
│   ├── FlipDigit.tsx          # 3D flip animation component (~150 lines)
│   └── TimerSettings.tsx      # Settings modal UI (~340 lines)
│
├── services/
│   └── audioService.ts        # Audio playback service (~250 lines)
│
└── public/
    ├── manifest.webmanifest   # PWA manifest
    └── sw.js                  # Service worker for offline support
```

## Key Features

### Timer Modes
1. **Countdown** - Counts down from set duration to zero
2. **Countup** - Counts up from zero indefinitely
3. **Hybrid** - Countdown to zero, then auto-switches to countup

### Alert System
- Color alerts at configurable time thresholds
- Flash effects on critical alerts
- Audio alerts (synthesized beeps)
- Default alerts: 5min (yellow), 1min (orange+flash), 10sec (red+flash+sound)

### Persistence
- Settings automatically saved to localStorage
- Persists: mode, duration, alerts, display options, audio preferences

### Display Options
- Optional hours and days display
- Dark/light theme (respects system preference)
- Time labels below digits
- Blinking separators when running

### Audio Service
- Extensible audio service (`services/audioService.ts`)
- Synthesized sounds via Web Audio API (no external files needed)
- Support for custom audio files (preload and play any URL)
- Sound types: `tick`, `alert`, `warning`, `finish`, `start`, `pause`
- Volume control and enable/disable toggle
- Built-in sounds:
  - **tick**: Subtle mechanical click
  - **alert**: Attention beep (880Hz)
  - **warning**: Urgent double beep (sawtooth)
  - **finish**: Triumphant chime (C5→E5→G5→C6 arpeggio)
  - **start**: Rising tone confirmation
  - **pause**: Descending tone

## Component Architecture

```
App.tsx (dark mode state)
└── FlipClockTimer (main state manager)
    ├── FlipClockDisplay
    │   ├── FlipDigit (days - optional)
    │   ├── FlipDigit (hours - optional)
    │   ├── FlipDigit (minutes)
    │   └── FlipDigit (seconds)
    ├── Preset buttons (inline)
    ├── Control buttons (inline)
    └── TimerSettings (modal)
```

## State Management (FlipClockTimer)

```typescript
// Types (defined in FlipClockTimer.tsx)
type TimerMode = 'countdown' | 'countup' | 'hybrid';
type TimerStatus = 'idle' | 'running' | 'paused' | 'completed';

interface ColorAlert {
  id: string;
  timeInSeconds: number;
  colorClass: string;      // Tailwind class (e.g., 'text-red-500')
  flash: boolean;
  sound: boolean;
  label: string;
}

interface TimerConfig {
  mode: TimerMode;
  initialTimeInSeconds: number;
  colorAlerts: ColorAlert[];
  showHours: boolean;
  showDays: boolean;
  playTickSound: boolean;
  playAlertSound: boolean;
}

// Main state
config: TimerConfig           // Persisted to localStorage
timeInSeconds: number         // Current time value
status: TimerStatus           // idle | running | paused | completed
hybridPhase: 'countdown' | 'countup'  // For hybrid mode
currentColorClass: string     // Active alert color
isFlashing: boolean           // Flash effect active
```

## FlipDigit Animation Logic

The flip animation uses CSS 3D transforms with careful state management to prevent flickering:

1. **Static cards** (always visible):
   - Upper static: Shows new value (covered by top flap during animation)
   - Lower static: Shows old value (covered by bottom flap after animation)

2. **Animated flaps** (only during flip):
   - Top flap: Shows old value, rotates down (0° → -90°) in 0.3s
   - Bottom flap: Shows new value, rotates up (90° → 0°) with 0.3s delay

3. **Flicker prevention**:
   - `isValueMismatch` detects the frame where props changed but useEffect hasn't run
   - `upperStaticValue` shows previous value during that frame

## Animation Keyframes (in index.html)

```javascript
// Tailwind config extension
animation: {
  'flip-top-down': 'flipTopDown 0.3s ease-in both',
  'flip-bottom-up': 'flipBottomUp 0.3s ease-out 0.3s both',
  'blink': 'blink 1s infinite',
  'slide-up': 'slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
}
```

## Development Commands

```bash
npm install       # Install dependencies
npm run dev       # Start dev server (port 3000)
npm run build     # Production build → /dist
npm run preview   # Preview production build
```

## Code Conventions

- Functional components with hooks
- `React.memo()` for performance (FlipDigit, FlipClockDisplay)
- Inline audio synthesis (no external sound files)
- TypeScript strict mode
- Tailwind for styling with `dark:` variants
- Path alias: `@/*` → project root

## Adding Custom Alarm Sounds (Future)

The audio service supports custom audio files. To add a custom alarm sound:

```typescript
import { audioService } from './services/audioService';

// Preload for faster playback (optional)
await audioService.preload('/sounds/my-alarm.mp3');

// Play the custom sound
await audioService.playCustom('/sounds/my-alarm.mp3');
```

Good sources for free alarm sounds:
- **Pixabay** (pixabay.com/sound-effects) - Free, no attribution required
- **Freesound.org** - Creative Commons sounds
- **Mixkit** (mixkit.co/free-sound-effects) - Free sound effects

To replace the default finish sound with a custom one, modify `FlipClockTimer.tsx`:
```typescript
// Instead of: audioService.play('finish');
audioService.playCustom('/sounds/custom-alarm.mp3');
```

## Recent Cleanup (Session Notes)

### Removed Files
- `components/SettingsModal.tsx` - Duplicate settings component
- `components/Controls.tsx` - Unused (controls inline in FlipClockTimer)
- `hooks/useTimer.ts` - Unused hook (logic inline in FlipClockTimer)
- `services/audioService.ts` - Unused (audio inline in FlipClockTimer)
- `types.ts` - Unused (types defined in FlipClockTimer)
- `constants.ts` - Unused (constants defined in FlipClockTimer)
- `.env.local` - Contained unused Gemini API key

### Improvements Made
- Cleaned up FlipDigit useEffect dependencies
- Added localStorage persistence for settings
- Added `type="button"` to all buttons
- Added `aria-label` and `title` to icon-only buttons
- Removed Gemini API references from vite.config.ts
- Created extensible audio service with custom sound support
- Added audio feedback for start/pause/resume actions

### Keyboard Shortcuts (Added)
| Key | Action |
|-----|--------|
| `Space` | Start / Pause / Resume |
| `R` | Reset timer (long-press when running) |
| `S` | Toggle settings |
| `F` | Toggle fullscreen |
| `B` | Toggle blackout mode (when running) |
| `Escape` | Close settings / Exit fullscreen / Exit blackout |

### Fullscreen Mode (Added)
- Toggle with `F` key or fullscreen button
- Clean, distraction-free timer display

### Blackout Mode (Added)
- Toggle with `B` key or blackout button (when running)
- Screen goes black while timer continues
- Tap or press any key to restore display
- Useful for saving battery during presentations

### Wake Lock API (Added)
- Prevents screen from sleeping during active timer
- Automatically releases on pause/reset/completion
- Re-acquires when tab becomes visible

### Reset Confirmation (Added)
- Long-press (1.5s) required to reset when timer is running
- Visual progress indicator on button
- Immediate reset when timer is idle (no confirmation)
- Prevents accidental resets during presentations

### Status Labels (Updated)
- **Countdown mode**: Ready → Countdown → Paused → Complete
- **Hybrid mode**: Ready → Presentation → Q&A → Paused → Complete
- **Countup mode**: Ready → Count-up → Paused

### Presets (Updated)
- Changed from: 1m, 5m, 15m, 30m, 1h
- Changed to: 5m, 10m, 15m, 20m, 30m, 45m, 60m

### Auto-format Hours (Added)
- Hours display auto-enabled when time >= 60 minutes

### Timestamp-Based Timer (Critical Fix)
- Timer now uses `Date.now()` timestamps instead of interval counting
- **Immune to browser throttling** when tab is inactive
- Accurate timing even after switching tabs for extended periods
- Refs: `startTimeRef`, `pausedAtRef`, `totalPausedMsRef`, `initialTimeRef`

### PWA Support (Added)
- `public/manifest.webmanifest` - App manifest for installation
- `public/sw.js` - Service worker for offline caching
- iOS/Android "Add to Home Screen" support
- Standalone app mode (no browser chrome)
