import { Injectable, computed, inject, signal } from '@angular/core';
import { initializeApp, deleteApp } from 'firebase/app';
import { createUserWithEmailAndPassword, getAuth, signOut } from 'firebase/auth';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { firebaseConfig, firestoreDb } from './firebase';
import { AuthService } from './auth.service';
import { Member, MemberUpdateInput, NewMemberInput } from '../models/member.model';
import { NotificationService } from './notification.service';

const COLLECTION = 'members';

@Injectable({ providedIn: 'root' })
export class MemberService {
  private readonly auth = inject(AuthService);
  private readonly notifications = inject(NotificationService);

  readonly members = signal<Member[]>([]);
  readonly loaded = signal(false);

  /** The Firestore member profile for whoever is currently logged in (undefined until matched). */
  readonly currentMember = computed<Member | undefined>(() => {
    const uid = this.auth.user()?.uid;
    if (!uid) return undefined;
    return this.members().find((m) => m.uid === uid);
  });

  /** True only for logged-in users whose member profile has role: 'admin'. */
  readonly isAdmin = computed(() => this.currentMember()?.role === 'admin');

  /** The single member currently authorized to confirm UPI payments received, if any. */
  readonly paymentApprover = computed<Member | undefined>(() =>
    this.members().find((m) => m.isPaymentApprover === true)
  );

  /** True only for the logged-in user who is the assigned payment approver. */
  readonly isPaymentApprover = computed(() => this.currentMember()?.isPaymentApprover === true);

  private unsubscribe: (() => void) | null = null;
  private loadedResolve!: () => void;
  private readonly loadedPromise = new Promise<void>((resolve) => {
    this.loadedResolve = resolve;
  });

  constructor() {
    this.listen();
  }

  /** Resolves once the first realtime snapshot has come back (or errored). */
  whenLoaded(): Promise<void> {
    return this.loadedPromise;
  }

  private listen(): void {
    const q = query(collection(firestoreDb, COLLECTION), orderBy('order', 'asc'));
    this.unsubscribe = onSnapshot(
      q,
      (snap) => {
        const list: Member[] = snap.docs.map((d) => {
          const data = d.data() as any;
          return {
            id: d.id,
            name: data['name'],
            order: data['order'] ?? 0,
            createdAt: data['createdAt']?.toMillis?.() ?? Date.now(),
            // New optional fields — existing docs without them simply come back as undefined,
            // so old members keep working exactly as before everywhere else in the app.
            uid: data['uid'],
            email: data['email'],
            phone: data['phone'],
            role: data['role'],
            status: data['status'],
            upiId: data['upiId'] ?? undefined,
            isPaymentApprover: data['isPaymentApprover'] ?? undefined,
          };
        });
        this.members.set(list);
        this.loaded.set(true);
        this.loadedResolve();
      },
      (err) => {
        console.error('members onSnapshot error', err);
        this.loaded.set(true);
        this.loadedResolve();
      }
    );
  }

  /**
   * Creates a Firebase Auth account for the new member on a secondary, throwaway Firebase
   * app instance — this keeps the currently logged-in admin's session untouched, since
   * createUserWithEmailAndPassword() would otherwise sign in as the new user on the main app.
   * Only the resulting UID is ever written to Firestore; the temporary password is never stored.
   */
  async addMember(input: NewMemberInput): Promise<void> {
    const name = input.name.trim();
    const email = input.email.trim();
    if (!name || !email || !input.tempPassword) return;

    const secondaryApp = initializeApp(firebaseConfig, `secondary-${Date.now()}`);
    const secondaryAuth = getAuth(secondaryApp);

    try {
      const credential = await createUserWithEmailAndPassword(secondaryAuth, email, input.tempPassword);
      const uid = credential.user.uid;

      await signOut(secondaryAuth);

      const nextOrder = this.members().length
        ? Math.max(...this.members().map((m) => m.order)) + 1
        : 0;

      // Doc ID = UID so Firestore rules can cheaply look up "is the caller an admin?"
      await setDoc(doc(firestoreDb, COLLECTION, uid), {
        uid,
        name,
        email,
        phone: input.phone?.trim() || null,
        role: input.role,
        status: input.status,
        order: nextOrder,
        createdAt: serverTimestamp(),
      });
      await this.notifications.notify(
  'member_joined',
  'New Roommate',
  `${name} joined Nestly.`,
  '/settings'
);
    } finally {
      await deleteApp(secondaryApp);
    }
  }
  

  /**
   * Updates the Firestore profile only. Email/password changes for other users require
   * the Firebase Admin SDK (e.g. a Cloud Function) — not possible from the client SDK.
   */
  async updateMember(id: string, updates: MemberUpdateInput): Promise<void> {
    const name = updates.name.trim();
    if (!name) return;
    await updateDoc(doc(firestoreDb, COLLECTION, id), {
      name,
      phone: updates.phone?.trim() || null,
      role: updates.role,
      status: updates.status,
    });
  }

  /**
   * Removes the Firestore profile only. The Firebase Auth account is not deleted — the
   * client SDK cannot delete other users' accounts. That requires a Cloud Function with
   * the Admin SDK (admin.auth().deleteUser(uid)).
   */
  async deleteMember(id: string): Promise<void> {
    await deleteDoc(doc(firestoreDb, COLLECTION, id));
  }

  /**
   * Admin-only (enforced by Firestore rules, same as updateMember/deleteMember above).
   * Only one member can be the payment approver at a time, so this flips the flag off
   * on everyone else in the same batch as it flips it on for `memberId`.
   */
  async setPaymentApprover(memberId: string): Promise<void> {
    const batch = writeBatch(firestoreDb);
    let touched = false;
    for (const m of this.members()) {
      const shouldBeApprover = m.id === memberId;
      if (!!m.isPaymentApprover !== shouldBeApprover) {
        batch.update(doc(firestoreDb, COLLECTION, m.id), { isPaymentApprover: shouldBeApprover });
        touched = true;
      }
    }
    if (touched) await batch.commit();
  }

  /**
   * Self-service — a member sets their own UPI ID (used as the "Pay via UPI" receiver when
   * they're the payment approver). Firestore rules restrict this to the caller's own doc
   * and to the `upiId` field only, so admins are never required to enter it on someone's behalf.
   */
  async updateOwnUpiId(upiId: string): Promise<void> {
    const uid = this.auth.user()?.uid;
    if (!uid) return;
    await updateDoc(doc(firestoreDb, COLLECTION, uid), { upiId: upiId.trim() || null });
  }

  /** Unchanged — still supports the original name-only seed for first-run/demo data. */
  async seedDefaultsIfEmpty(): Promise<void> {
    if (this.members().length > 0) return;
    const defaults = ['Venkat', 'Sai', 'Ravi', 'Manoj'];
    for (let i = 0; i < defaults.length; i++) {
      await addDoc(collection(firestoreDb, COLLECTION), {
        name: defaults[i],
        order: i,
        createdAt: serverTimestamp(),
      });
    }
  }
}