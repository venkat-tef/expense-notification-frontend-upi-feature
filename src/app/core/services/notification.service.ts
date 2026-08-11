import {
  Injectable,
  inject,
  signal,
  computed,
  NgZone,
} from '@angular/core';

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
import {
  AppNotification,
  NotificationType,
} from '../models/notification.model';

const COLLECTION = 'notifications';
const PROMPTED_KEY = 'nestly_notif_prompted';

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly auth = inject(AuthService);
  private readonly zone = inject(NgZone);

  readonly permission = signal<
    NotificationPermission | 'unsupported'
  >(
    typeof Notification === 'undefined'
      ? 'unsupported'
      : Notification.permission
  );

  private readonly rawNotifications =
    signal<AppNotification[]>([]);

  readonly notifications = computed(() => {
    const uid = this.auth.user()?.uid;

    return this.rawNotifications().filter(
      (n) =>
        !n.targetMemberId ||
        n.targetMemberId === uid
    );
  });

  readonly unreadCount = computed(() => {
    const uid = this.auth.user()?.uid;

    if (!uid) {
      return 0;
    }

    return this.notifications().filter(
      (n) => !n.readBy.includes(uid)
    ).length;
  });

  constructor() {
    this.listen();
  }

  // ============================================================
  // LISTEN TO NOTIFICATIONS
  // ============================================================

  private listen(): void {
    const q = query(
      collection(firestoreDb, COLLECTION),
      orderBy('createdAt', 'desc'),
      limit(50)
    );

    this.zone.runOutsideAngular(() => {
      onSnapshot(q, (snap) => {
        this.zone.run(() => {
          const list: AppNotification[] =
            snap.docs.map((d) => {
              const data = d.data() as any;

              return {
                id: d.id,

                type: data['type'],

                title: data['title'],

                body: data['body'],

                url:
                  data['url'] ??
                  '/dashboard',

                targetMemberId:
                  data['targetMemberId'] ??
                  undefined,

                createdAt:
                  data['createdAt']?.toMillis?.() ??
                  Date.now(),

                readBy:
                  data['readBy'] ?? [],
              };
            });

          this.rawNotifications.set(list);
        });
      });
    });
  }

  // ============================================================
  // REQUEST PERMISSION
  // ============================================================

  async requestPermissionOnce(): Promise<void> {
    if (this.permission() === 'unsupported') {
      return;
    }

    if (
      localStorage.getItem(PROMPTED_KEY)
    ) {
      return;
    }

    localStorage.setItem(
      PROMPTED_KEY,
      '1'
    );

    const result =
      await Notification.requestPermission();

    this.permission.set(result);
  }

  async requestPermission(): Promise<void> {
    if (this.permission() === 'unsupported') {
      return;
    }

    const result =
      await Notification.requestPermission();

    this.permission.set(result);
  }

  // ============================================================
  // MARK AS READ
  // ============================================================

  async markRead(id: string): Promise<void> {
    const uid = this.auth.user()?.uid;

    if (!uid) {
      return;
    }

    await updateDoc(
      doc(firestoreDb, COLLECTION, id),
      {
        readBy: arrayUnion(uid),
      }
    );
  }

  // ============================================================
  // MARK ALL READ
  // ============================================================

  async markAllRead(): Promise<void> {
    const uid = this.auth.user()?.uid;

    if (!uid) {
      return;
    }

    await Promise.all(
      this.notifications()
        .filter(
          (n) => !n.readBy.includes(uid)
        )
        .map((n) => this.markRead(n.id))
    );
  }

  // ============================================================
  // CREATE NOTIFICATION
  // ============================================================

  async notify(
    type: NotificationType,
    title: string,
    body: string,
    url: string,
    notificationId?: string
  ): Promise<void> {
    const currentUid =
      this.auth.user()?.uid;

    if (!currentUid) {
      return;
    }

    /*
     * IMPORTANT:
     * Every notification event gets its own ID.
     *
     * If caller provides one, use it.
     * Otherwise generate a unique ID.
     */
    const eventNotificationId =
      notificationId ??
      `${type}_${Date.now()}_${crypto.randomUUID()}`;

    const membersSnap =
      await getDocs(
        collection(
          firestoreDb,
          'members'
        )
      );

    const promises: Promise<unknown>[] = [];

    for (
      const member of membersSnap.docs
    ) {
      const memberUid =
        member.data()['uid'] ??
        member.id;

      // Do not notify the person who performed the action.
      if (
        !memberUid ||
        memberUid === currentUid
      ) {
        continue;
      }

      promises.push(
        addDoc(
          collection(
            firestoreDb,
            COLLECTION
          ),
          {
            type,
            title,
            body,
            url,

            targetMemberId: memberUid,

            // IMPORTANT:
            // This is the ID that will eventually
            // become the FCM/browser notification tag.
            notificationId:
              eventNotificationId,

            createdAt:
              serverTimestamp(),

            readBy: [],
          }
        )
      );
    }

    await Promise.all(promises);
  }

  // ============================================================
  // NOTIFY A SINGLE MEMBER (event-based — ALWAYS creates a new doc)
  // ============================================================
  //
  // Same addDoc() shape as notify(), but addressed to exactly one target
  // member instead of "everyone except the current user". Use this for any
  // flow that needs to notify one specific person (e.g. the settlement
  // approver, or one member's individualized power-bill share) while still
  // recording every occurrence as its own permanent history entry.
  //
  // IMPORTANT: unlike notifyOnce(), this NEVER checks for an existing doc —
  // every call is a brand-new event. Do not pass a fixed/deterministic
  // notificationId here expecting de-duplication; that's what notifyOnce()
  // is for, and only for genuinely idempotent, once-per-key notifications
  // (e.g. "today's duty reminder", keyed by date).
  async notifyMember(
    type: NotificationType,
    title: string,
    body: string,
    url: string,
    targetUid: string,
    notificationId?: string
  ): Promise<void> {
    if (!targetUid) {
      return;
    }

    const eventNotificationId =
      notificationId ??
      `${type}_${Date.now()}_${crypto.randomUUID()}`;

    await addDoc(
      collection(firestoreDb, COLLECTION),
      {
        type,
        title,
        body,
        url,

        targetMemberId: targetUid,

        notificationId: eventNotificationId,

        createdAt: serverTimestamp(),

        readBy: [],
      }
    );
  }

  // ============================================================
  // NOTIFY ONCE
  // ============================================================

  async notifyOnce(
    id: string,
    memberId: string,
    type: NotificationType,
    title: string,
    body: string,
    url: string
  ): Promise<void> {
    const ref = doc(
      firestoreDb,
      COLLECTION,
      id
    );

    const existing =
      await getDoc(ref);

    if (existing.exists()) {
      return;
    }

    await setDoc(
      ref,
      {
        type,
        title,
        body,
        url,
        targetMemberId: memberId,

        notificationId: id,

        createdAt:
          serverTimestamp(),

        readBy: [],
      }
    );
  }

  // ============================================================
  // ANNOUNCEMENT
  // ============================================================

  async sendAnnouncement(
    title: string,
    body: string
  ): Promise<void> {
    await this.notify(
      'announcement',
      title,
      body,
      '/dashboard'
    );
  }
}