# ChronoFlip v2 Revision — Verification Checklist

**Date:** 2026-04-10
**Version:** v2 (post-revision)
**For:** QA / Client sign-off

This checklist covers all 6 changes requested in the v2 revision document, plus regression checks for features that should still work as before. Work through it top-to-bottom on a real device. Each item has a clear expected result — tick it if it matches, flag it if not.

---

## How to Test

1. Open the app in a web browser (URL will be provided once deployed to Amplify)
2. Log in with the provided admin email and password
3. Work through each section below in order
4. For anything that fails, note:
   - Which step
   - What you expected
   - What actually happened
   - Screenshot if possible

---

## Section 1: Event List Screen

### 1.1 — "+ New Event" Button Label
- [ ] Open the app — you land on the event list screen
- [ ] Confirm the button at the bottom says **"+ New Event"** (text, not just a `+` icon)
- [ ] Tap the button — a new untitled event is created and you are taken into its settings
- [ ] Return to the event list — the new event appears in the list

### 1.2 — Empty State Text
- [ ] Delete all events (swipe each card left) until the list is empty
- [ ] Confirm the empty state message says **"No events yet. Tap + New Event to create one."**

---

## Section 2: Venue Name on Events

### 2.1 — Adding a Venue Name
- [ ] Create a new event called "Test Event"
- [ ] Inside the event settings, tap the venue name field (placeholder: "Add venue name...")
- [ ] Type "Main Hall" and tap outside to save
- [ ] Refresh the page — venue name persists

### 2.2 — Venue Name on Event Card
- [ ] Return to the event list
- [ ] Confirm "Main Hall" appears below the event title on the card, in a lighter smaller font
- [ ] Edit the event and clear the venue name (make it empty)
- [ ] Return to the event list — the venue name line is hidden when empty

### 2.3 — Backwards Compatibility
- [ ] Old events with no venue name render normally with no broken layout

---

## Section 3: Event Settings Screen

### 3.1 — "+ New Timer" Button Label
- [ ] Open any event's settings
- [ ] Confirm the main "add timer" button says **"+ New Timer"** (text, not just `+`)
- [ ] Tap it — a new segment is created at the end of the list

### 3.2 — "+ New Group" Button
- [ ] Confirm there is a second button labelled **"+ New Group"**
- [ ] Tap it — a new group container appears with a default name ("New Group") and one timer inside it
- [ ] The group has a distinct violet border so it is visually separate from loose timers

### 3.3 — Empty State Text
- [ ] Create a new event and delete all auto-created segments
- [ ] Confirm the empty state says **"No segments yet. Tap + New Timer to add one."**

---

## Section 4: Timer Grouping

### 4.1 — Renaming a Group
- [ ] Inside an event, create a group
- [ ] Tap the group name header — it becomes editable
- [ ] Type "Special Lecture" and tap outside to save
- [ ] Refresh — the new name persists

### 4.2 — Adding Timers to a Group
- [ ] Inside the group, tap "+ New Timer" (the one inside the group block)
- [ ] A new timer is added inside that group (not as a loose timer below)
- [ ] Add 2 timers to the group so it has 3 total

### 4.3 — Assigning an Existing Loose Timer to a Group
- [ ] Create a loose timer (tap the top-level "+ New Timer", outside any group)
- [ ] Tap the loose timer to open segment settings
- [ ] Find the **Group** dropdown — it should list "None (ungrouped)" and "Special Lecture"
- [ ] Select "Special Lecture" and save
- [ ] Back in event settings, the timer now appears inside the group block

### 4.4 — Removing a Timer from a Group
- [ ] Open a grouped timer's settings
- [ ] Change the Group dropdown to "None (ungrouped)"
- [ ] Save — the timer is now a loose timer again

### 4.5 — Interleaved Layout (Loose + Groups)
- [ ] Create a layout like this:
  1. Loose timer: "Opening"
  2. Group "Lecture 1" with 2 timers
  3. Loose timer: "Break"
  4. Group "Lecture 2" with 2 timers
- [ ] Confirm the groups appear as violet blocks and loose timers appear between them in the correct order
- [ ] Refresh — order and groups persist

### 4.6 — Deleting a Group
- [ ] Create a group with 2 timers inside
- [ ] Delete the group (group header delete button)
- [ ] Expected: the group is removed **but the 2 timers remain as loose timers** (they are not deleted)

### 4.7 — Existing Events Still Work
- [ ] Open an old event created before this update
- [ ] Confirm it renders normally as a flat list of loose timers (no broken layout, no ghost groups)

---

## Section 5: Timer Running Screen

### 5.1 — Start All (No Group)
- [ ] Open an event with loose timers only
- [ ] Tap the top "Start" button
- [ ] Timer starts running the first segment
- [ ] Let a segment complete — it auto-advances to the next
- [ ] Exit and confirm you return to event settings

### 5.2 — Start Group
- [ ] Open an event with a group containing 2+ timers, plus other loose timers
- [ ] Tap the **"Start"** button **on the group header** (not the top one)
- [ ] Timer starts running — only group timers run
- [ ] Confirm: segment counter shows `1 / N` where N = number of timers in the group (NOT the total event size)
- [ ] Confirm: the **group name** ("Special Lecture") appears in the header above the segment name
- [ ] Let all group segments complete — at the end, timer shows completion, does not jump to loose timers after the group

### 5.3 — Group-Aware Restart
- [ ] Start a group, let it advance to the 2nd or 3rd segment inside the group
- [ ] Hold the **Restart** button for 1.5s (or hold **R**)
- [ ] Expected: timer goes back to the **first segment of the current group** (not segment 0 of the whole event)

### 5.4 — Start All Restart (unchanged behavior)
- [ ] Start the timer via the top "Start All" button
- [ ] Let it advance to segment 3 or 4
- [ ] Hold Restart — timer goes to segment 0 of the whole event (original behavior)

### 5.5 — Prev / Next Group Buttons
- [ ] Create an event with 2 groups and at least 1 loose timer between them
- [ ] Start the first group
- [ ] Confirm **"< Prev Group"** and **"Next Group >"** buttons are visible between Restart and Exit
- [ ] Tap **Next Group** — timer jumps to the first segment of the next group, timer is paused (must press Start)
- [ ] Tap **Prev Group** — timer jumps back to the first segment of the previous group
- [ ] When on the first group, **Prev Group** is disabled/hidden
- [ ] When on the last group, **Next Group** is disabled/hidden

### 5.6 — Prev/Next Hidden When Not in Group Mode
- [ ] Start the timer via the top "Start All" button (not a group start)
- [ ] Confirm the Prev/Next Group buttons are **hidden** (they only appear in group mode)

### 5.7 — Screen On Button Removed
- [ ] Look at the running timer controls
- [ ] Confirm there is **no Screen On / sun / moon toggle button**
- [ ] The screen should still stay awake while the timer is running (this is automatic now)

### 5.8 — Keyboard Shortcuts
Start a group and try each shortcut:
- [ ] `Space` — Start / Pause / Resume
- [ ] Hold `R` for 1.5s — Restart (goes to first segment of group)
- [ ] Hold `E` for 3s — Exit to edit screen
- [ ] `[` or `P` — Prev Group
- [ ] `]` or `N` — Next Group
- [ ] `F` — Toggle fullscreen
- [ ] `B` — Blackout mode
- [ ] `Esc` — Dismiss flash / exit blackout / exit fullscreen

### 5.9 — Help Modal Shortcut List
- [ ] Open the Help modal
- [ ] Confirm the keyboard shortcuts section lists `[ / P` for prev group and `] / N` for next group
- [ ] Confirm there is **no "W" / Screen On** shortcut listed
- [ ] Check the Japanese section has the same shortcuts translated

---

## Section 6: Real-Time Sync (Viewer Screen)

**Setup:** Open two browser windows side by side — one for the admin (timer controller) and one for the viewer.

### 6.1 — Share Event with Viewer
- [ ] On admin, create an event with a group of 2 timers
- [ ] Get the viewer link / QR code
- [ ] Open the viewer link in the second browser window

### 6.2 — Venue Name Appears on Viewer
- [ ] Set a venue name on the event on admin side
- [ ] Confirm viewer receives the updated event (may need to wait up to a few seconds)
- [ ] _(Note: display of venue name on viewer is optional — confirm it at least doesn't break the viewer if present)_

### 6.3 — Group Name Appears on Viewer
- [ ] On admin, start the group
- [ ] On viewer, confirm the current segment name is visible
- [ ] _(Optional: if viewer UI shows group name, confirm it matches the admin's group name)_

### 6.4 — Navigation Syncs
- [ ] On admin, press **Next Group** (or navigate segments)
- [ ] Viewer updates to reflect the new segment in real-time
- [ ] Pause on admin — viewer reflects the pause
- [ ] Resume on admin — viewer resumes

### 6.5 — Multi-Viewer
- [ ] Open a third browser window/tab as another viewer
- [ ] Start a segment on admin — both viewers update simultaneously

---

## Section 7: Regression — Existing Features Still Work

### 7.1 — Segment Settings
- [ ] Open any segment's settings
- [ ] Change duration — saves correctly
- [ ] Change count mode (countdown/countup) — saves correctly
- [ ] Change color alerts — saves correctly
- [ ] Change alarm sound — plays and saves
- [ ] Change tick sound — plays and saves

### 7.2 — Scheduled Start
- [ ] Set a scheduled start time on an event
- [ ] Confirm the countdown appears on the timer screen
- [ ] Let it tick down or test with a time ~1 minute in the future

### 7.3 — Flip Digit Animation
- [ ] Start any timer
- [ ] Confirm the digits flip smoothly as time changes (no flicker, no jumpy animation)

### 7.4 — Color Alerts
- [ ] Create a segment with a 10-second duration and a color alert at 5 seconds
- [ ] Start it and confirm the background color changes at the 5s mark
- [ ] Confirm the color persists until the next alert or segment ends

### 7.5 — Dark Mode
- [ ] Toggle dark mode — UI colors flip between light and dark
- [ ] Setting persists after refresh

### 7.6 — Fullscreen / Blackout
- [ ] Press F — enters fullscreen
- [ ] Press B while running — screen goes black but timer keeps running
- [ ] Press Esc — exits blackout / exits fullscreen

### 7.7 — Event Create / Edit / Delete
- [ ] Create an event
- [ ] Edit its title
- [ ] Reorder its segments by dragging
- [ ] Delete the event (swipe left on the card)
- [ ] Sign out and sign back in — the event is still deleted (synced to cloud)

### 7.8 — Multi-Device Sync
- [ ] On device A, create an event
- [ ] On device B (same login), confirm the event appears within a few seconds
- [ ] On device A, edit the event title
- [ ] On device B, confirm the update arrives in real-time

---

## Summary

**Total sections:** 7
**Total check items:** ~75

Once this is complete, mark the overall status:

- [ ] **All checks pass — ready for production**
- [ ] **Passed with minor issues** — list them below
- [ ] **Blocked — needs fixes before release**

### Issues Found

| # | Section | Description | Severity | Screenshot |
|---|---------|-------------|----------|------------|
|   |         |             |          |            |
|   |         |             |          |            |
|   |         |             |          |            |

---

**Tested by:** _________________
**Date:** _________________
**Sign-off:** _________________
