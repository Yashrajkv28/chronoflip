# ChronoFlip

A premium flip clock timer with elegant 3D animations, perfect for presentations, meetings, and time management.

![ChronoFlip Timer](https://img.shields.io/badge/React-19.2-blue) ![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue) ![Vite](https://img.shields.io/badge/Vite-6.2-purple)

## Features

- **3D Flip Animations** - Smooth, realistic flip clock digit transitions
- **Multiple Timer Modes**
  - Countdown - Count down from a set duration
  - Count-up - Count up from zero
  - Hybrid - Countdown then auto-switch to count-up (great for presentations + Q&A)
- **Customizable Alerts** - Color changes, flash effects, and audio alerts at configurable time thresholds
- **Glassmorphic UI** - Modern frosted glass design with dark/light theme support
- **Keyboard Shortcuts** - Full keyboard control for hands-free operation
- **Fullscreen Mode** - Distraction-free timer display
- **Blackout Mode** - Screen goes black while timer continues (saves battery)
- **PWA Support** - Install as an app on mobile/desktop
- **Wake Lock** - Prevents screen sleep during active timer

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Space` | Start / Pause / Resume |
| `R` | Reset (hold 1.5s when running) |
| `S` | Toggle Settings |
| `F` | Toggle Fullscreen |
| `B` | Toggle Blackout (when running) |
| `Escape` | Close modal / Exit fullscreen / Exit blackout |

## Quick Start

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

## Tech Stack

- React 19
- TypeScript
- Vite
- Tailwind CSS
- Web Audio API (synthesized sounds)

## Presets

Quick-select timers: 5m, 10m, 15m, 20m, 30m, 45m, 60m

## License

MIT
