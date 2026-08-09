
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
import { onDocumentCreated, onDocumentWritten } from 'firebase-functions/v2/firestore';
import { onSchedule } from 'firebase-functions/v2/scheduler';

initializeApp();
const db = getFirestore();
const messaging = getMessaging();
const TZ = 'Asia/Kolkata';

interface TokenRef {
  token: string;
  path: string;
}

async function tokensForMembers(memberIds: string[]): Promise<TokenRef[]> {
  const results: TokenRef[] = [];

  for (const id of memberIds) {
    const snap = await db.collection('members').doc(id).collection('fcmTokens').get();
    snap.forEach((d) => results.push({ token: d.id, path: d.ref.path }));
  }

  return results;
}

async function allMemberIds(excludeId?: string): Promise<string[]> {
  const snap = await db.collection('members').get();
  return snap.docs.map((d) => d.id).filter((id) => id !== excludeId);
}

async function send(
  tokens: TokenRef[],
  title: string,
  body: string,
  data: Record<string, string> = {}
): Promise<void> {
  if (!tokens.length) return;

  const res = await messaging.sendEachForMulticast({
    tokens: tokens.map((t) => t.token),
    notification: { title, body },
    data,
    webpush: { fcmOptions: { link: data['url'] ?? '/dashboard' } },
  });

  // Clean up dead tokens so the app stops trying them.
// Clean up dead tokens so the app stops trying them.
const deletions: Promise<unknown>[] = [];

res.responses.forEach((r, i) => {
  if (
    !r.success &&
    (
      r.error?.code === 'messaging/registration-token-not-registered' ||
      r.error?.code === 'messaging/invalid-registration-token'
    )
  ) {
    deletions.push(db.doc(tokens[i].path).delete());
  }
});

await Promise.all(deletions);
}



// ---------- FEATURE 1: Expense Added ----------
// REMOVED: this used to be `onExpenseCreated`, triggered on the same `expenses/{id}`
// creation event that the Render backend's expenseListener.js already handles. Having
// both meant every expense produced TWO separate FCM push sends (this function's, and
// Render's) — the root cause of the original duplicate-notification bug. This copy also
// excluded only `paidByMemberId`, not `createdByUid`, so whenever the person adding the
// expense wasn't the payer, they'd incorrectly get notified too.
//
// Render's expenseListener.js is the single source of truth for expense-created pushes
// now (it already excludes the correct actor and has listener watchdog/reconnect
// recovery). If Render is ever retired in favor of Cloud Functions only, re-add this
// trigger using `e.createdByUid ?? e.paidByMemberId` as the excluded id — do NOT run
// both at once.

// ---------- FEATURE 7: New Member ----------
export const onMemberCreated = onDocumentCreated('members/{uid}', async (event) => {
  const m = event.data?.data();
  if (!m) return;

  const others = await allMemberIds(event.params.uid);
  const tokens = await tokensForMembers(others);

  await send(
    tokens,
    'New Roommate',
    `${m.name} joined Nestly.`,
    { type: 'member_joined', url: '/settings' }
  );
});

// ---------- FEATURE 4: Admin Announcement ----------
export const onAnnouncementCreated = onDocumentCreated(
  'announcements/{id}',
  async (event) => {
    const a = event.data?.data();
    if (!a) return;

    // NEW — draft/inactive announcements are saved but never pushed.
    if (a.status === 'inactive') return;

    const ids = await allMemberIds();

    // Existing behavior — unchanged.
    const tokens = await tokensForMembers(ids);
    await send(
      tokens,
      a.title,
      a.body,
      { type: 'announcement', url: '/dashboard' }
    );

    // NEW — bell entries, one doc per recipient, matching NotificationService's schema
    // exactly (targetMemberId, readBy: [], createdAt) so the existing notification-sheet
    // component picks these up with zero frontend changes.
    const batch = db.batch();

    for (const memberId of ids) {
      const ref = db.collection('notifications').doc();

      batch.set(ref, {
        type: 'announcement_bell',
        title: a.title,
        body: a.body,
        url: '/dashboard',
        targetMemberId: memberId,
        createdAt: FieldValue.serverTimestamp(),
        readBy: [],
      });
    }

    await batch.commit();
  }
);

// ---------- FEATURE 6: Skip Notification (Water) ----------
export const onWaterSkip = onDocumentWritten(
  'water_records/{date}',
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();

    if (
      !after?.skippedMemberId ||
      before?.skippedMemberId === after.skippedMemberId
    ) {
      return;
    }

    const [skipped, assigned] = await Promise.all([
      db.collection('members').doc(after.skippedMemberId).get(),
      db.collection('members').doc(after.memberId).get(),
    ]);

    const ids = await allMemberIds();
    const tokens = await tokensForMembers(ids);

    await send(
      tokens,
      'Water Turn Skipped',
      `${skipped.data()?.name ?? 'Someone'} skipped today's Water Turn. ${assigned.data()?.name ?? 'Someone'} has been assigned automatically.`,
      { type: 'skip', url: '/water' }
    );
  }
);

// ---------- FEATURE 6: Skip Notification (Garbage) ----------
export const onGarbageSkip = onDocumentWritten(
  'cooking_records/{date}',
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();

    if (
      !after?.skippedMemberId ||
      before?.skippedMemberId === after.skippedMemberId
    ) {
      return;
    }

    const [skipped, assigned] = await Promise.all([
      db.collection('members').doc(after.skippedMemberId).get(),
      db.collection('members').doc(after.memberId).get(),
    ]);

    const ids = await allMemberIds();
    const tokens = await tokensForMembers(ids);

    await send(
      tokens,
      'Garbage Turn Skipped',
      `${skipped.data()?.name ?? 'Someone'} skipped today's Garbage Turn. ${assigned.data()?.name ?? 'Someone'} has been assigned automatically.`,
      { type: 'skip', url: '/cooking' }
    );
  }
);

// ---------- FEATURES 2, 3, 5: Daily reminders (one scheduled run) ----------
export const dailyReminders = onSchedule(
  { schedule: '0 8 * * *', timeZone: TZ },
  async () => {
    const today = new Date().toLocaleDateString('en-CA', {
      timeZone: TZ,
    });

    const monthKey = today.slice(0, 7);

    // Guest members are excluded from duty rotation/reminders.
    const members = (await db.collection('members').get()).docs
      .map((d) => ({ id: d.id, ...d.data() } as any))
      .filter((m) => m.role !== 'guest')
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

    // Feature 5: Duty reminders — only if today has no record yet.
    for (const [collectionName, label, url] of [
      ['water_records', 'Water', '/water'],
      ['cooking_records', 'Garbage', '/cooking'],
    ] as const) {
      const todayDoc = await db.collection(collectionName).doc(today).get();

      if (todayDoc.exists) continue;

      const lastSnap = await db
        .collection(collectionName)
        .orderBy('date', 'desc')
        .limit(1)
        .get();

      const lastMemberId = lastSnap.docs[0]?.data()?.memberId;

      const idx = lastMemberId
        ? members.findIndex((m) => m.id === lastMemberId)
        : -1;

      const next =
        members[(idx + 1 + members.length) % (members.length || 1)];

      if (!next) continue;

      const tokens = await tokensForMembers([next.id]);

      await send(
        tokens,
        `Today's ${label} Turn`,
        `It's your turn today.`,
        { type: 'duty', url }
      );
    }

    // Features 2 & 3: Settlement / Power Bill reminders.
    const summaryDoc = await db
      .collection('monthly_summary')
      .doc(monthKey)
      .get();

    const summary = summaryDoc.data();

    if (summary && summary.settlementCompleted !== true) {
      const expenseCount = (
        await db
          .collection('expenses')
          .where('monthKey', '==', monthKey)
          .limit(1)
          .get()
      ).size;

      const ids = await allMemberIds();
      const tokens = await tokensForMembers(ids);

      if (expenseCount > 0) {
        await send(
          tokens,
          'Reminder',
          'You still have pending settlements. Open Nestly to settle them.',
          { type: 'settlement', url: '/expenses' }
        );
      }

      if (summary.electricityBillSet === true) {
        await send(
          tokens,
          'Electricity Bill Pending',
          "Please complete your share for this month's electricity bill.",
          { type: 'power_bill', url: '/expenses' }
        );
      }
    }
  }
);

