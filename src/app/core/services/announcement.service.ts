import { Injectable, inject, signal } from '@angular/core';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { firestoreDb } from './firebase';
import { MemberService } from './member.service';
import { NotificationService } from './notification.service';
import { Announcement, AnnouncementInput } from '../models/announcement.model';

const COLLECTION = 'announcements';

/**
 * Editable, listable record of announcements, backed by the `announcements` collection.
 *
 * IMPORTANT — notification delivery: `create()` below calls
 * NotificationService.sendAnnouncement() directly, the same call every other
 * "announcement" push already goes through — this writes one doc per recipient
 * straight into the `notifications` collection, which the existing Render backend's
 * announcementListener.js already watches and already knows how to push for (type
 * 'announcement' was already in its PUSH_ELIGIBLE_TYPES). That listener already has
 * watchdog/reconnect recovery and a reconciliation safety net, the same infrastructure
 * expense and settlement notifications rely on — reusing it here means delivery no
 * longer depends on the separate Firebase Cloud Function
 * (functions/src/onAnnouncementCreated) at all, which was a second, independent push
 * pipeline for this one notification type. That Cloud Function has been made a no-op
 * (see functions/src/index.ts) specifically to avoid a double push now that this method
 * sends it directly — do not re-enable both at once.
 */
@Injectable({ providedIn: 'root' })
export class AnnouncementService {
  private readonly memberService = inject(MemberService);
  private readonly notifications = inject(NotificationService);

  readonly announcements = signal<Announcement[]>([]);
  readonly loaded = signal(false);

  constructor() {
    this.listen();
  }

  private listen(): void {
    const q = query(collection(firestoreDb, COLLECTION), orderBy('createdAt', 'desc'));
    onSnapshot(
      q,
      (snap) => {
        const list: Announcement[] = snap.docs.map((d) => {
          const data = d.data() as any;
          return {
            id: d.id,
            title: data['title'] ?? '',
            body: data['body'] ?? '',
            status: data['status'] ?? 'active',
            createdAt: data['createdAt']?.toMillis?.() ?? Date.now(),
            updatedAt: data['updatedAt']?.toMillis?.() ?? Date.now(),
            createdByName: data['createdByName'] ?? undefined,
          };
        });
        this.announcements.set(list);
        this.loaded.set(true);
      },
      (err) => {
        console.error('announcements onSnapshot error', err);
        this.loaded.set(true);
      }
    );
  }

  /**
   * Creates the announcement doc AND sends the notification (bell + push) in the same
   * client action — no longer waiting on a separate Cloud Function trigger, which is
   * what was causing announcements to arrive late (Cloud Functions v2 cold-start) or,
   * if that function wasn't deployed/billing-enabled, not arrive at all. Drafts
   * (status: 'inactive') are still saved but never notify — same behavior as before.
   */
  async create(input: AnnouncementInput): Promise<void> {
    const title = input.title.trim();
    const body = input.body.trim();
    if (!title || !body) return;

    await addDoc(collection(firestoreDb, COLLECTION), {
      title,
      body,
      status: input.status,
      createdByName: this.memberService.currentMember()?.name ?? null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    if (input.status !== 'inactive') {
      await this.notifications.sendAnnouncement(title, body);
    }
  }

  /** Edits the list entry only. Never re-sends a notification — same as before. */
  async update(id: string, input: AnnouncementInput): Promise<void> {
    const title = input.title.trim();
    const body = input.body.trim();
    if (!title || !body) return;

    await updateDoc(doc(firestoreDb, COLLECTION, id), {
      title,
      body,
      status: input.status,
      updatedAt: serverTimestamp(),
    });
  }

  async remove(id: string): Promise<void> {
    await deleteDoc(doc(firestoreDb, COLLECTION, id));
  }
}