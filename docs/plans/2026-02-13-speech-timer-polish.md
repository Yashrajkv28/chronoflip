# Speech Timer UI Polish Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix all remaining UI inconsistencies, accessibility gaps, and minor polish issues across all 4 speech timer screens to bring them to parity with the v1 flip clock timer.

**Architecture:** Surgical edits only — no new files, no structural changes. Each task targets a specific component with exact line-level fixes.

**Tech Stack:** React 19, TypeScript, Tailwind CSS (CDN), no tests (pure UI polish)

---

## Audit Summary (8.6/10 baseline)

| Category | Score | After Fix |
|----------|-------|-----------|
| Button Styling Consistency | 9/10 | 10/10 |
| Dark Mode Support | 10/10 | 10/10 |
| Mobile Responsiveness | 8/10 | 10/10 |
| Accessibility (aria-labels) | 7/10 | 10/10 |
| Glassmorphic Patterns | 9/10 | 10/10 |

---

### Task 1: Add aria-labels to Toggle switches in SegmentSettingsScreen

**Files:**
- Modify: `components/screens/SegmentSettingsScreen.tsx:62-77` (Toggle component)

**Step 1: Add aria-label to the Toggle component**

The `Toggle` component (line 62-77) renders a `<button>` with no `aria-label`. Add it:

```tsx
// Line 65-66: change from
<button
  type="button"
  onClick={() => onChange(!value)}

// to
<button
  type="button"
  onClick={() => onChange(!value)}
  aria-label={label}
  role="switch"
  aria-checked={value}
```

**Step 2: Add aria-labels to inline Flash toggle (line 344)**

```tsx
// Line 344: change from
<button
  type="button"
  onClick={() => updateAlert(alert.id, { flash: !alert.flash })}

// to
<button
  type="button"
  onClick={() => updateAlert(alert.id, { flash: !alert.flash })}
  aria-label="Flash"
  role="switch"
  aria-checked={alert.flash}
```

**Step 3: Add aria-labels to inline Background toggle (line 358)**

```tsx
// Line 358: change from
<button
  type="button"
  onClick={() => updateAlert(alert.id, { background: !alert.background })}

// to
<button
  type="button"
  onClick={() => updateAlert(alert.id, { background: !alert.background })}
  aria-label="Background"
  role="switch"
  aria-checked={alert.background}
```

**Step 4: Verify build**

Run: `npm run build`
Expected: Build succeeds with no errors.

**Step 5: Commit**

```bash
git add components/screens/SegmentSettingsScreen.tsx
git commit -m "a11y: add aria-labels and switch roles to toggle buttons in SegmentSettingsScreen"
```

---

### Task 2: Add responsive breakpoints to preset buttons in SegmentSettingsScreen

**Files:**
- Modify: `components/screens/SegmentSettingsScreen.tsx:156-183` (preset buttons)

**Step 1: Update preset button sizing for mobile**

```tsx
// Line 156: change from
<div className="flex flex-wrap gap-2 mt-3 justify-center">

// to
<div className="flex flex-wrap gap-1.5 sm:gap-2 mt-3 justify-center">
```

```tsx
// Line 175: change from
className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200

// to
className={`px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg text-[11px] sm:text-xs font-semibold transition-all duration-200
```

**Step 2: Verify build**

Run: `npm run build`
Expected: Build succeeds with no errors.

**Step 3: Commit**

```bash
git add components/screens/SegmentSettingsScreen.tsx
git commit -m "ui: add responsive breakpoints to preset duration buttons"
```

---

### Task 3: Unify delete alert button styling in SegmentSettingsScreen

**Files:**
- Modify: `components/screens/SegmentSettingsScreen.tsx:288-295` (delete alert button)

**Step 1: Replace the delete button style**

The current delete alert button uses `bg-zinc-200/80 dark:bg-zinc-700/80` with a confusing hover-to-red transition. Unify with the standard delete pattern used in EventCard and SegmentCard.

```tsx
// Lines 288-290: change from
className="ml-auto w-6 h-6 flex items-center justify-center rounded-full
           bg-zinc-200/80 dark:bg-zinc-700/80 text-zinc-500
           hover:bg-red-500 hover:text-white transition-colors"

// to
className="ml-auto w-7 h-7 flex items-center justify-center rounded-full
           text-zinc-400 dark:text-zinc-500
           hover:bg-red-500/15 hover:text-red-500
           transition-all duration-200"
```

**Step 2: Verify build**

Run: `npm run build`
Expected: Build succeeds with no errors.

**Step 3: Commit**

```bash
git add components/screens/SegmentSettingsScreen.tsx
git commit -m "ui: unify delete alert button styling with other delete buttons"
```

---

### Task 4: Increase ScrollWheelPicker selection highlight visibility

**Files:**
- Modify: `components/ui/ScrollWheelPicker.tsx:92`

**Step 1: Increase border opacity**

```tsx
// Line 92: change from
className="absolute pointer-events-none left-0 right-0 border-t border-b border-blue-500/30 dark:border-blue-400/30"

// to
className="absolute pointer-events-none left-0 right-0 border-t-2 border-b-2 border-blue-500/40 dark:border-blue-400/40"
```

**Step 2: Verify build**

Run: `npm run build`
Expected: Build succeeds with no errors.

**Step 3: Commit**

```bash
git add components/ui/ScrollWheelPicker.tsx
git commit -m "ui: increase ScrollWheelPicker selection highlight visibility"
```

---

### Task 5: Standardize Schedule Start button scale to match other buttons

**Files:**
- Modify: `components/screens/EventSettingsScreen.tsx:290`

**Step 1: Update hover/active scale**

```tsx
// Line 290: change from
hover:scale-[1.01] active:scale-[0.99]

// to
hover:scale-105 active:scale-95
```

**Step 2: Verify build**

Run: `npm run build`
Expected: Build succeeds with no errors.

**Step 3: Commit**

```bash
git add components/screens/EventSettingsScreen.tsx
git commit -m "ui: standardize schedule start button scale with other action buttons"
```

---

### Task 6: Final full build + visual verification checklist

**Step 1: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: Zero errors.

**Step 2: Run production build**

Run: `npm run build`
Expected: Build succeeds.

**Step 3: Visual verification checklist**

Manually verify (or describe expected state for each):

- [ ] **EventListScreen**: Edit button glassmorphic, Clock button glassmorphic, + button rounded with shadow
- [ ] **EventSettingsScreen**: Edit button glassmorphic, START button emerald with glow, + button rounded, purple duration pill visible, Schedule Start section matches v1 card style with full-width pink button
- [ ] **SegmentSettingsScreen**: Preset buttons wrap properly on mobile, toggles have aria-labels, delete alert button uses red hover pattern (not solid red bg), color alert cards have 3-row layout
- [ ] **TimerRunningScreen**: Pause/Resume/Start buttons large (px-10 py-5), color alerts trigger background tint, flash, and sound correctly
- [ ] **Dark mode**: All screens render correctly — no invisible text, no missing borders, no broken backgrounds
- [ ] **ScrollWheelPicker**: Selection highlight clearly visible in both light and dark mode

**Step 4: Commit (if any visual fixes needed)**

```bash
git add -A
git commit -m "chore: final speech timer UI polish pass"
```

---

## Files Summary

| File | Tasks | Changes |
|------|-------|---------|
| `components/screens/SegmentSettingsScreen.tsx` | 1, 2, 3 | aria-labels, responsive presets, delete button style |
| `components/ui/ScrollWheelPicker.tsx` | 4 | Selection highlight visibility |
| `components/screens/EventSettingsScreen.tsx` | 5 | Button scale consistency |

**Total edits:** 5 files, ~15 line changes
**Risk level:** Low — all changes are CSS/attribute-only, no logic changes
**Estimated tasks:** 6 (5 code + 1 verification)
