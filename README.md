# ☭ Iron Soviet — Daily Strength & Nutrition Tracker

A no-nonsense, Soviet periodization-inspired web app for daily training and nutrition accountability. Open it, tap the day, check off your lifts and meals, done.

**Live site:** hosted on GitHub Pages

---

## What It Does

| Feature | Description |
|---------|-------------|
| **Day selector (M T W Th F Sa Su)** | Tap any day to see the plan. Training days (M/W/F) show the workout; rest days (T/Th/Sa/Su) show food only. |
| **Workout checklist** | 7 exercises per session — same pool every training day, intensity varies by day type. Each exercise is a tappable checkbox. |
| **Heavy / Volume / Light rotation** | Monday = Heavy (3–5 reps, long rest), Wednesday = Volume (8–12 reps), Friday = Light/Technique (8–10 reps, light load). |
| **Weight & rep logging** | Inline inputs per set. Auto-suggests last session's numbers so you just confirm or bump up. |
| **Progression flags** | When you hit the top of the rep range for all sets, the app flags that exercise for a weight increase next session. |
| **Daily food checklist** | 7 nutrition items with checkboxes that reset daily. Track your fuel every single day. |
| **Avoid list** | Persistent safety reminders — no cold stretching, no failure sets, no flared elbows, etc. |
| **Warm-up & cooldown** | Collapsible sections with specific prep and stretch routines. |
| **Bodyweight log** | Quick input to track your weight over time. |
| **localStorage persistence** | All data saved locally — no server, no login, no excuses. Auto-cleans data older than 30 days. |

---

## Exercise Pool

These are the only exercises in the program — chosen for safety, minimal equipment, and maximal adherence:

| Slot | Exercise | Equipment |
|------|----------|-----------|
| Push | Push-Ups (weighted once BW is easy) | Bodyweight ± backpack |
| Pull | Kettlebell Row (one arm) | Kettlebell |
| Legs (squat) | Goblet Squat | Kettlebell |
| Legs (hinge) | Hamstring Curl Machine | Gym machine |
| Shoulder | Overhead Press (KB, neutral grip) | Kettlebell |
| Core | Dead Bug | Bodyweight |
| Conditioning | Row Machine / Ski Erg | Gym machines |

> No pull-ups (no bar needed), no Romanian deadlifts (back risk), no ab wheel (spinal compression), no Bulgarian split squats (balance issues). Every exercise is joint-safe and equipment-matched.

---

## Day Types

| Day | Type | Sets × Reps | Rest | Focus |
|-----|------|-------------|------|-------|
| Monday | **Heavy** | 4 × 3–5 | 2–3 min | Strength |
| Wednesday | **Volume** | 3 × 8–12 | 90s | Hypertrophy |
| Friday | **Light** | 3 × 8–10 | 60s | Technique & speed |
| Tue/Thu/Sat/Sun | **Rest** | — | — | Food checklist only |

---

## Daily Nutrition Checklist

Every day, check off:

- [ ] 8–9 boiled eggs
- [ ] 150–200g chicken breast
- [ ] 1–2 spicy chicken paranthas
- [ ] 500ml milk
- [ ] 5g creatine
- [ ] Fish oil · Vitamin D · B12
- [ ] Orange + raw spinach



## Tech Stack

- **Pure HTML / CSS / JavaScript** — no frameworks, no build step
- **localStorage** for all persistence
- **GitHub Pages** for hosting (static files only)
- **Inter + JetBrains Mono** fonts via Google Fonts

---

## Deploying to GitHub Pages

1. Push this repo to GitHub.
2. Go to **Settings → Pages**.
3. Set source to **Deploy from a branch** → `main` → `/ (root)`.
4. Site will be live at `https://<username>.github.io/sovietworkout/`.

---

## Project Structure

```
sovietworkout/
├── index.html          # Main page
├── app.js              # All logic, state, rendering
├── style.css           # Dark military theme
├── manifest.json       # PWA manifest
├── README.md           # This file
├── FIXGUIDE.md         # Original fix guide / design doc
└── assets/
    ├── icons/          # Favicons & PWA icons
    └── exercises/      # Exercise form photos (add your own PNGs)
```

---

## License

Personal use. Train hard, eat everything on the list, don't skip creatine.