# ChronoFlip - Project Documentation

## Overview

**ChronoFlip** is a speech timer web application built with React and TypeScript. It features elegant 3D flip animations, customizable color-based alerts per segment, and a glassmorphic UI design. Users create events with multiple timed segments that auto-advance during presentations.

> **Note:** The full multi-mode version (clock, countdown, countup, hybrid + speech timer) lives on the `ver-2-complete` branch. This `main` branch is speech-timer-only.

## Tech Stack

- **Language:** TypeScript 5.8.2
- **Framework:** React 19.2.4
- **Build Tool:** Vite 6.2.0
- **Styling:** Tailwind CSS (CDN)
- **Audio:** Web Audio API (synthesized sounds + custom MP3 files)

## Project Structure

```
chronoflip/
├── App.tsx                    # Root component, navigation, CRUD, dark mode
├── config.ts                  # Orb/appearance config (loadConfig, saveConfig)
├── types.ts                   # Speech timer types (SpeechEvent, Segment, etc.)
├── index.tsx                  # Entry point (ReactDOM.createRoot)
├── index.html                 # HTML template with Tailwind config & animations
├── styles.css                 # Global styles
├── vite.config.ts             # Vite configuration
├── tsconfig.json              # TypeScript configuration
├── package.json               # Dependencies
│
├── components/
│   ├── FlipClockDisplay.tsx   # Digit layout and separators
│   ├── FlipDigit.tsx          # 3D flip animation component
│   ├── TimerSettings.tsx      # Appearance settings modal (orb customization)
│   ├── HelpModal.tsx          # Help & keyboard shortcuts modal
│   ├── screens/
│   │   ├── EventListScreen.tsx      # Event list (home screen)
│   │   ├── EventSettingsScreen.tsx   # Event settings & segment list
│   │   ├── SegmentSettingsScreen.tsx # Segment settings (duration, alerts, etc.)
│   │   └── TimerRunningScreen.tsx    # Running timer display
│   └── ui/
│       ├── ColorPicker.tsx          # Color selection UI
│       ├── EventCard.tsx            # Event card component
│       ├── SegmentCard.tsx          # Segment card component
│       ├── SegmentTransition.tsx    # Segment transition animation
│       └── ScrollWheelPicker.tsx    # Scroll wheel picker
│
├── hooks/
│   ├── useTimer.ts            # Timer logic (used by TimerRunningScreen)
│   ├── useWakeLock.ts         # Wake lock API
│   ├── useSwipeToDelete.ts    # Swipe gesture for cards
│   └── usePersistence.ts      # localStorage persistence
│
├── services/
│   └── audioService.ts        # Audio playback service
│
└── public/
    ├── manifest.webmanifest   # PWA manifest
    ├── sw.js                  # Service worker for offline support
    ├── sounds/                # Custom alarm MP3 files
    └── icons/                 # App icons
```

## Key Features

### Speech Timer
- Create multiple events, each with multiple timed segments
- Each segment has its own duration, count mode (countdown/countup), color alerts, tick sound, alarm, and flash settings
- Segments auto-advance when complete
- Scheduled start: set a specific date/time to auto-start

### Alert System (per segment)
- Color alerts at configurable time thresholds
- Background color persistence until next alert
- Flash effects (3 blinks)
- Audio alerts (synthesized beeps + custom alarm sounds)
- Haptic feedback on supported devices

### Persistence
- Events and segments saved to localStorage
- Orb appearance config saved separately
- Dark mode preference persisted

### Display
- 3D flip digit animations
- Dark/light theme (respects system preference)
- Customizable background orbs (dark mode)
- Fullscreen mode
- Blackout mode (screen goes black, timer continues)

### Audio Service
- Extensible audio service (`services/audioService.ts`)
- Synthesized sounds via Web Audio API
- Support for custom audio files (preload and play any URL)
- Sound types: `tick`, `alert`, `warning`, `finish`, `start`, `pause`

## Component Architecture

```
App.tsx (state manager, navigation, CRUD)
├── EventListScreen (home)
│   └── EventCard (per event, swipe-to-delete)
├── EventSettingsScreen
│   └── SegmentCard (per segment, swipe-to-delete)
├── SegmentSettingsScreen
│   ├── ColorPicker
│   └── ScrollWheelPicker
├── TimerRunningScreen
│   ├── FlipClockDisplay
│   │   └── FlipDigit (per digit)
│   └── SegmentTransition
├── TimerSettings (appearance/orb modal)
└── HelpModal
```

## FlipDigit Animation Logic

The flip animation uses CSS 3D transforms with careful state management to prevent flickering:

1. **Static cards** (always visible):
   - Upper static: Shows new value (covered by top flap during animation)
   - Lower static: Shows old value (covered by bottom flap after animation)

2. **Animated flaps** (only during flip):
   - Top flap: Shows old value, rotates down (0deg to -90deg) in 0.3s
   - Bottom flap: Shows new value, rotates up (90deg to 0deg) with 0.3s delay

3. **Flicker prevention**:
   - `isValueMismatch` detects the frame where props changed but useEffect hasn't run
   - `upperStaticValue` shows previous value during that frame

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
- TypeScript strict mode
- Tailwind for styling with `dark:` variants
- Path alias: `@/*` → project root

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Space` | Start / Pause / Resume |
| `R` | Reset (hold 1.5s when running) |
| `F` | Toggle fullscreen |
| `B` | Blackout mode (when running) |
| `D` | Toggle dark mode |
| `Escape` | Close / Exit fullscreen / Exit blackout |

## Deployment

- Vercel auto-detects Vite, no vercel.json needed
- Deploy manually with `npx vercel --prod`
- Fully static SPA, no env vars needed at runtime

## PWA Support

- `public/manifest.webmanifest` - App manifest for installation
- `public/sw.js` - Service worker for offline caching
- iOS/Android "Add to Home Screen" support
- Standalone app mode (no browser chrome)
