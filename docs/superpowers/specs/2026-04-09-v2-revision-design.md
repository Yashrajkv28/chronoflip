# ChronoFlip v2 Revision — Design Spec

**Date:** 2026-04-09
**Status:** Approved
**Origin:** Client document "Speech Timer Revision Request ver.2"

---

## Overview

Six changes requested by the client for the ChronoFlip speech timer app used by ~1000 students at a Japanese university. The largest change is timer grouping — allowing segments within an event to be organized into named groups that can be started, restarted, and navigated independently.

---

## Change 1: "+ New Event" Button Label

**Screen:** EventListScreen
**Current:** Icon-only `+` button
**New:** Text button reading `+ New Event`
**Files:** `components/screens/EventListScreen.tsx`

---

## Change 2: Venue Name Field

**Screen:** EventSettingsScreen, EventCard
**What:** Add optional `venueName` string to events.

**Data model (`types.ts`):**
```typescript
interface SpeechEvent {
  // ...existing fields unchanged...
  venueName?: string;  // NEW
}
```

**Event settings screen:** Editable venue name below the event title. Same inline-edit pattern as the title (click to edit, blur to save). Placeholder: "Add venue name..."

**Event card (list screen):** Venue name displayed below event title in lighter/smaller text. Hidden if empty.

**Files:** `types.ts`, `components/screens/EventSettingsScreen.tsx`, `components/ui/EventCard.tsx`

---

## Change 3: "+ New Timer" Button Label

**Screen:** EventSettingsScreen
**Current:** Icon-only `+` button
**New:** Text button reading `+ New Timer`
**Files:** `components/screens/EventSettingsScreen.tsx`

---

## Change 4: Timer Grouping

### Data Model

```typescript
// NEW type
interface TimerGroup {
  id: string;
  name: string;
}

// MODIFIED — Segment gets optional groupId
interface Segment {
  // ...all existing fields unchanged...
  groupId?: string;  // NEW — undefined = loose/ungrouped timer
}

// MODIFIED — SpeechEvent gets groups array
interface SpeechEvent {
  // ...all existing fields unchanged...
  groups?: TimerGroup[];  // NEW — group metadata (id + name)
}
```

### How Grouping Works

- The `segments` array order is the single source of truth for display and execution order.
- Consecutive segments sharing the same `groupId` form a visual group.
- Segments without a `groupId` are loose/ungrouped (behave as today).
- The `groups` array on the event stores group metadata (name keyed by id).
- Groups and loose timers can be interleaved in any order.

**Example:**
```
segments: [
  { name: "Opening",              groupId: undefined },  // loose
  { name: "Lecture (Presentation)", groupId: "g1" },      // group
  { name: "Lecture (Q&A)",         groupId: "g1" },      // group
  { name: "Break",                groupId: undefined },  // loose
  { name: "Neuro (Presentation)",  groupId: "g2" },      // group
  { name: "Neuro (Q&A)",          groupId: "g2" },      // group
]
groups: [
  { id: "g1", name: "Special Lecture" },
  { id: "g2", name: "Future Neuroscience" }
]
```

### Backwards Compatibility

Existing events have no `groupId` on segments and no `groups` array. They work unchanged — everything renders as ungrouped, all existing behavior preserved.

### Event Settings Screen Layout

Segments rendered in array order with group detection:

```
Opening Remarks                    2:00  COUNTDOWN
┌─ Special Lecture ──────────────────── [▶ START]
│  Lecture (Presentation)          5:00  COUNTDOWN
│  Lecture (Q&A)                   3:00  COUNTDOWN
│  [+ New Timer]
└───────────────────────────────────────────────
Break                              5:00  COUNTDOWN
┌─ Future Neuroscience ────────────── [▶ START]
│  Neuro (Presentation)            7:00  COUNTDOWN
│  Neuro (Q&A)                     5:00  COUNTDOWN
│  [+ New Timer]
└───────────────────────────────────────────────
```

- Each group block: bordered container with editable group name header, group-level START button, and a `+ New Timer` inside (adds timer with that `groupId`).
- Top-level `+ New Timer` creates an ungrouped timer.
- `+ New Group` button (new, in the button row) creates a new group with default name "New Group" and one default timer inside.

### Drag and Drop

**Simple mode (no cross-boundary dragging):**
- Loose timers and whole groups reorder among each other (top-level ordering).
- Timers within a group reorder within that group only.
- No dragging timers in/out of groups — use segment settings to assign/unassign a group.

### Segment Settings Screen

- Add a "Group" dropdown/selector to SegmentSettingsScreen.
- Options: "None (ungrouped)" + list of existing group names.
- Selecting a group sets `groupId` on the segment and moves it to the end of that group's consecutive run in the array.
- Selecting "None" removes `groupId`.

### Start Behavior

- **"Start All"** (top START button on event settings): Runs every segment in array order, ignoring group boundaries. Same as current behavior.
- **"Start Group"** (START button on a group header): Runs only the segments with that `groupId`, in their array order.

**Files:** `types.ts`, `components/screens/EventSettingsScreen.tsx`, `components/screens/SegmentSettingsScreen.tsx`, `components/ui/SegmentCard.tsx`

---

## Change 5: Timer Running Screen

### Remove Screen On Button

The Screen On (wake lock toggle) button is removed. Wake lock auto-activates when the timer is running (existing behavior in `useEffect`), so the manual toggle is redundant.

### Prev/Next Group Buttons

Two new buttons added between Restart and Exit in the controls bar:

**New control order:**
```
[START/PAUSE/RESUME]  [RESTART]  [◀ Prev Group]  [Next Group ▶]  [EXIT]  [Fullscreen]  [Blackout]
```

**Visibility:** Only shown when the timer was started from a group (via group START button). Hidden when running "start all" or a loose timer.

**Behavior:**
- **Next Group:** Stops current timer, jumps to first segment of the next group in array order. Timer enters idle state (must press Start). If no next group exists, button disabled/hidden.
- **Prev Group:** Same but jumps to the previous group. If no previous group, disabled/hidden.
- After jumping, timer is idle — does not auto-start.

### Restart Behavior Change

- **When running a group:** Restart goes to the first segment of the current group (not segment 0 of the whole event).
- **When running all or a loose timer:** Restart goes to segment 0 (same as today).

### Group Name in Header

When running a group, display the group name above the segment name:

```
  COUNTDOWN    2 / 4
  Special Lecture              ← group name
  Q&A Session                  ← segment name
```

### New Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `[` or `P` | Previous group (when running a group) |
| `]` or `N` | Next group (when running a group) |

### Passing Context to TimerRunningScreen

TimerRunningScreen currently receives `event`, `startSegmentIndex`, and `onExit`. It needs additional context:

```typescript
interface TimerRunningScreenProps {
  event: SpeechEvent;
  startSegmentIndex: number;
  onExit: () => void;
  // NEW:
  activeGroupId?: string;       // which group was started (undefined = start all / loose)
  groupSegmentIndices?: number[]; // indices into event.segments for the active group
}
```

When `activeGroupId` is set:
- Only iterate through `groupSegmentIndices`
- Restart resets to `groupSegmentIndices[0]`
- Prev/Next group navigate to adjacent groups
- Segment counter shows "2 / 4" relative to group size, not total event size

**Files:** `components/screens/TimerRunningScreen.tsx`, `App.tsx` (passes new props)

---

## Change 6: Sync & Viewer Updates

### TimerSyncState Addition

```typescript
interface TimerSyncState {
  // ...all existing fields unchanged...
  activeGroupId?: string;  // NEW — null when running loose timers or "start all"
}
```

### SharedEvent / SharedSegment Additions

```typescript
interface SharedEvent {
  id: string;
  title: string;
  venueName?: string;                    // NEW
  segments: SharedSegment[];
  groups?: { id: string; name: string }[];  // NEW
  scheduledStartTime: number | null;
}

// SharedSegment Pick adds groupId
type SharedSegment = Pick<Segment, 'id' | 'name' | 'durationSeconds' | 'mode' | 'color' | 'groupId'>;
```

### What Flows Through Existing Infrastructure

- `publishEvent` serializes full event including new fields — no code change needed.
- `publishTimerState` sends `activeGroupId` — viewers receive it via existing `onTimerStateUpdate` subscription.
- Group navigation (prev/next) triggers `publishTimerState` with updated `currentSegmentIndex` and `activeGroupId`.
- No new subscriptions, mutations, resolvers, or DynamoDB tables needed.

### Viewer Screen

When viewer receives timer state with `activeGroupId`:
- Can display group name in header (looked up from shared event's `groups` array).
- Group switching by admin is reflected in real-time.

**Files:** `types.ts`, `services/syncService.ts`, `services/graphql/queries.ts`, `services/graphql/mutations.ts`

---

## AWS Changes (AppSync Schema Only)

Detailed in `yash.md`. Summary:
- Add `SharedGroup` type + `SharedGroupInput` input
- Add `groupId: String` to `SharedSegment` + `SharedSegmentInput`
- Add `venueName: String` and `groups: [SharedGroup!]` to `SharedEvent` + `SharedEventInput`
- Add `activeGroupId: String` to `TimerState` + `TimerStateInput`
- No resolver, table, subscription, or mutation changes needed.

---

## Out of Scope

- Cross-boundary drag and drop (dragging timers in/out of groups)
- Dark mode changes (already works, toggle removed from running screen only)
- Any changes to audio, flip digit animations, or PWA
- New DynamoDB tables or AppSync resolvers
