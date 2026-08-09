// PATCH — replace the existing `onAnnouncementCreated` export in functions/src/index.ts
// with this version. Everything else in index.ts (imports, helpers, other triggers)
// stays exactly as-is; this only changes the body of this one function.
//
// What changed and why:
//   1. Skips the push entirely when the announcement was created with status: 'inactive'
//      (new — the Settings > Announcements tab lets an admin save a draft without
//      blasting it to everyone).
//   2. Also writes one `notifications` doc per recipient, same shape NotificationService's
//      notify() already writes, so the announcement shows up in the in-app bell too — the
//      old flow got this for free because it wrote to `notifications` directly; writing to
//      `announcements` instead means the bell entries have to be added here instead.
//   3. Uses type 'announcement_bell' (NOT 'announcement') for those bell docs specifically
//      so Render's announcementListener.js — which pushes for type === 'announcement' —
//      never sees them and never sends a second push for the same announcement. This
//      function already sent the push above; Render's job here is only the (unrelated)
//      settlement_completed / settlement_ready / announcement types it already owns.

