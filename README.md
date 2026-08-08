# 🏠 RoomMate Manager

A mobile-first Angular 20 app for roommates to track daily **Water** and **Cooking**
duties fairly, with round-robin turn suggestions, a monthly calendar, full history,
and live stats — all backed by Firebase Firestore in real time.

## Tech stack

- Angular 20 — standalone components, Signals, new `@if`/`@for` control flow
- Angular Material 20 (Material 3 styling, dark mode)
- Firebase Firestore (realtime) + Firebase Authentication (Anonymous)
- Firebase Hosting
- SCSS, lazy-loaded routes

## Project structure

```
src/app/
  core/
    models/           # Member, TaskRecord, MemberStat interfaces
    services/
      firebase.ts          # Firebase app/firestore/auth singletons
      auth.service.ts       # anonymous sign-in
      member.service.ts     # roommate CRUD (realtime)
      record.service.ts     # shared base class for Water/Cooking records
      water.service.ts      # RecordServiceBase → 'water_records'
      cooking.service.ts    # RecordServiceBase → 'cooking_records'
  shared/components/
    bottom-nav/            # fixed bottom navigation
    task-calendar/         # reusable month calendar (used by Water & Cooking)
    member-picker-sheet/   # bottom sheet: tap a name → auto-saves, no submit
  features/
    dashboard/    # card grid home screen
    water/        # water calendar + next turn
    cooking/      # cooking calendar + next turn
    history/      # tabs: Water / Cooking history + search/filter + summary
    settings/     # add / edit / delete roommates
  app.ts, app.config.ts, app.routes.ts
```

## How it works

- **One record per day.** Water/cooking records are stored with the date
  (`YYYY-MM-DD`) as the Firestore document id, so tapping a roommate's name is a
  simple upsert — instant save, no submit button, no duplicates.
- **Round robin next-turn.** `RecordServiceBase.getNextMember()` looks at the most
  recent record and returns the next roommate in the members list (wrapping
  around), exactly as: Venkat → Sai → Ravi → Manoj → Venkat…
- **Water and Cooking are fully independent** — separate Firestore collections,
  separate calendars, separate history/stats, and the same person can be assigned
  to both on the same day.
- **Realtime everywhere.** All services use Firestore `onSnapshot` listeners, so
  every roommate's screen updates live as entries are added.
- **Dark mode** follows the system `prefers-color-scheme` automatically.

## Getting started

### 1. Install dependencies

```bash
npm install
```

### 2. Configure Firebase

Create a Firebase project at https://console.firebase.google.com, then:

1. Enable **Authentication → Sign-in method → Anonymous**.
2. Enable **Firestore Database** (start in production mode; the included
   `firestore.rules` only allows access to authenticated users).
3. Register a Web App in Project Settings and copy the config values into
   `src/environments/environment.ts` and `src/environments/environment.prod.ts`.

### 3. Run locally

```bash
ng serve
```

App runs at `http://localhost:4200`.

### 4. Deploy

See `DEPLOYMENT.md`.

## Firestore data model

```
members/{memberId}
  name: string
  order: number        // controls round-robin order & display order
  createdAt: timestamp

water_records/{YYYY-MM-DD}
  date: string
  memberId: string
  createdAt: timestamp

cooking_records/{YYYY-MM-DD}
  date: string
  memberId: string
  createdAt: timestamp
```
