import { Injectable, inject, signal, computed, NgZone } from '@angular/core';
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  arrayUnion,
  onSnapshot,
  orderBy,
  query,
  limit,
  serverTimestamp,
} from 'firebase/firestore';
import { firestoreDb } from './firebase';
import { AuthService } from './auth.service';
import { AppNotification, NotificationType } from '../models/notification.model';

const COLLECTION = 'notifications';
const PROMPTED_KEY = 'nestly_notif_prompted';

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly auth = inject(AuthService);
  private readonly zone = inject(NgZone);

  readonly permission = signal<NotificationPermission | 'unsupported'>(
    typeof Notification === 'undefined' ? 'unsupported' : Notification.permission
  );

  /** Raw docs straight from Firestore, unfiltered by user. */
  private readonly rawNotifications = signal<AppNotification[]>([]);

  /**
   * Filtered per-user view, derived as a computed() rather than filtered once inside the
   * snapshot callback. This makes it re-evaluate automatically whenever EITHER dependency
   * changes — including when auth.user() resolves after the first Firestore snapshot has
   * already arrived (slow cold start / mobile network), which previously caused some devices
   * to get stuck showing zero/stale notifications until an unrelated write forced a new snapshot.
   */
  readonly notifications = computed(() => {
    const uid = this.auth.user()?.uid;
    return this.rawNotifications().filter((n) => !n.targetMemberId || n.targetMemberId === uid);
  });

  readonly unreadCount = computed(() => {
    const uid = this.auth.user()?.uid;
    if (!uid) return 0;
    return this.notifications().filter((n) => !n.readBy.includes(uid)).length;
  });

  constructor() {
    this.listen();
  }

  private listen(): void {
    const q = query(collection(firestoreDb, COLLECTION), orderBy('createdAt', 'desc'), limit(50));

    // Register outside Angular's zone: Firestore's WebChannel transport fires internal events
    // zone.js doesn't reliably patch on every browser/WebView, and we don't want every one of
    // those forcing a CD sweep. We re-enter the zone explicitly (below) at the exact point we
    // write to signals — that's what guarantees the view repaints immediately and consistently,
    // instead of only updating once some unrelated zone task (navigation, a click) happens to
    // trigger the next CD run.
    this.zone.runOutsideAngular(() => {
      onSnapshot(q, (snap) => {
        this.zone.run(() => {
          const list: AppNotification[] = snap.docs.map((d) => {
            const data = d.data() as any;
            return {
              id: d.id,
              type: data['type'],
              title: data['title'],
              body: data['body'],
              url: data['url'] ?? '/dashboard',
              targetMemberId: data['targetMemberId'] ?? undefined,
              createdAt: data['createdAt']?.toMillis?.() ?? Date.now(),
              readBy: data['readBy'] ?? [],
            };
          });
          this.rawNotifications.set(list);

          // NOTE: this used to also fire a raw `new Notification(...)` popup here for
          // anything new/unread. That's been removed on purpose — it was a second,
          // independent OS-notification path running alongside FCM's service worker
          // popup, which is exactly what produced an extra notification (with a
          // correct preview, since it read straight from this doc) every time the app
          // tab was open. FCM (firebase-messaging-sw.js) is now the single, canonical
          // place a browser notification is ever displayed, in every app state. This
          // listener's only remaining job is keeping the bell badge count and the
          // notification history sheet in sync — both still update immediately, since
          // both are driven by rawNotifications/notifications() below, unchanged.
        });
      });
    });
  }
private showBrowserNotification(
  title: string,
  body: string,
  url: string
): void {

  if (document.visibilityState === 'visible') return;

  const notification = new Notification(title,{
      body,
      icon:'/icons/icon-192x192.png'
  });

  notification.onclick=()=>{
      window.focus();
      window.location.href=url;
  };
}
  /** Call once on app start. Only prompts if never asked before on this device. */
  async requestPermissionOnce(): Promise<void> {
    if (this.permission() === 'unsupported') return;
    if (localStorage.getItem(PROMPTED_KEY)) return;
    localStorage.setItem(PROMPTED_KEY, '1');
    const result = await Notification.requestPermission();
    this.permission.set(result);
  }

  /** Manual re-ask (e.g. a button in Settings if they previously dismissed/denied). */
  async requestPermission(): Promise<void> {
    if (this.permission() === 'unsupported') return;
    const result = await Notification.requestPermission();
    this.permission.set(result);
  }

  async markRead(id: string): Promise<void> {
    const uid = this.auth.user()?.uid;
    if (!uid) return;
    await updateDoc(doc(firestoreDb, COLLECTION, id), { readBy: arrayUnion(uid) });
  }

  async markAllRead(): Promise<void> {
    const uid = this.auth.user()?.uid;
    if (!uid) return;
    await Promise.all(
      this.notifications().filter((n) => !n.readBy.includes(uid)).map((n) => this.markRead(n.id))
    );
  }

  /** Broadcast notification, written by any client action (expense added, member joined, skip, announcement). */
  async notify(
    type: NotificationType,
    title: string,
    body: string,
    url: string
  ): Promise<void> {
    const currentUid = this.auth.user()?.uid;
    if (!currentUid) return;

    const membersSnap = await getDocs(collection(firestoreDb, 'members'));
    const promises = [];

    for (const member of membersSnap.docs) {
      // Falls back to the doc ID when the `uid` field is missing — members created via
      // seedDefaultsIfEmpty() (the original "Venkat, Sai, Ravi, Manoj" seed data) were
      // never given a `uid` field at all, only name/order/createdAt. Requiring the field
      // meant those members silently never got a `notifications` doc written for them —
      // no bell badge increment, nothing in the history sheet — while the FCM push
      // pipelines (which already key off the doc ID, not this field) worked fine for them.
      // Members created via the newer addMember() flow use uid as the doc ID anyway, so
      // this fallback is a no-op for them and only changes behavior for the legacy ones.
      const uid = member.data()['uid'] ?? member.id;
      if (!uid || uid === currentUid) continue;

      promises.push(
        addDoc(collection(firestoreDb, COLLECTION), {
          type,
          title,
          body,
          url,
          targetMemberId: uid,
          createdAt: serverTimestamp(),
          readBy: [],
        })
      );
    }

    await Promise.all(promises);
  }

  /**
   * Duty/settlement reminders that should only be written ONCE per member per day —
   * re-opening the app shouldn't spam a new doc (and therefore a new bell entry) every time.
   */
  async notifyOnce(id: string, memberId: string, type: NotificationType, title: string, body: string, url: string): Promise<void> {
    const ref = doc(firestoreDb, COLLECTION, id);
    const existing = await getDoc(ref);
    if (existing.exists()) return;
    await setDoc(ref, {
      type, title, body, url, targetMemberId: memberId,
      createdAt: serverTimestamp(),
      readBy: [],
    });
  }

  /** Admin-only, enforced by Firestore rules. Kept as `sendAnnouncement` — Settings already calls this name. */
  async sendAnnouncement(title: string, body: string): Promise<void> {
    await this.notify('announcement', title, body, '/dashboard');
  }
}