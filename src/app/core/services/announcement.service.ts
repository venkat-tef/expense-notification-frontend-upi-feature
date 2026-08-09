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
import { Announcement, AnnouncementInput } from '../models/announcement.model';

const COLLECTION = 'announcements';

/**
 * Editable, listable record of announcements, backed by the `announcements` collection
 * that ALREADY EXISTS in firestore.rules and functions/src/index.ts's onAnnouncementCreated
 * trigger — that Cloud Function currently never fires because nothing writes here yet.
 *
 * IMPORTANT: this deliberately does NOT also call NotificationService.notify()/
 * sendAnnouncement(). onAnnouncementCreated already sends the FCM push (and, once you
 * apply the functions/src/index.ts patch alongside this file, writes the bell entries
 * too) the moment this doc is created. Calling notify() here as well would push twice —
 * once from this write, once from Render's announcementListener.js picking up the
 * separate notifications doc. One write, one push pipeline.
 */
@Injectable({ providedIn: 'root' })
export class AnnouncementService {
  private readonly memberService = inject(MemberService);

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
   * Creates the announcement doc. The existing onAnnouncementCreated Cloud Function
   * (once patched to respect `status`) is what actually sends the push — not this method.
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
  }

  /** Edits the list entry only. Never re-triggers a push — the Cloud Function only fires on create. */
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
