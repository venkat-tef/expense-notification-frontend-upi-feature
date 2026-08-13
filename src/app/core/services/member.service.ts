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
import {
  deleteObject,
  ref,
} from 'firebase/storage';
import { firebaseConfig, firestoreDb, firebaseStorage } from './firebase';
import { AuthService } from './auth.service';
import { Member, MemberUpdateInput, NewMemberInput } from '../models/member.model';
import { NotificationService } from './notification.service';
import { CloudinaryService } from './cloudinary.service';

const COLLECTION = 'members';

@Injectable({ providedIn: 'root' })
export class MemberService {
  private readonly auth = inject(AuthService);
  private readonly notifications = inject(NotificationService);
  private readonly cloudinary = inject(CloudinaryService);

  readonly members = signal<Member[]>([]);
  readonly loaded = signal(false);




/** Members eligible for Water/Garbage duty rotation. Guests are excluded. */
readonly rotationEligibleMembers = computed<Member[]>(() =>
  this.members().filter((m) => m.role !== 'guest')
);





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
            // Profile photo — undefined/missing simply means "no photo" everywhere it's
            // read, so every existing member without one keeps showing initials exactly
            // as before.
            photoUrl: data['photoUrl'] ?? undefined,
            photoPath: data['photoPath'] ?? undefined,
            photoPublicId: data['photoPublicId'] ?? undefined,
            // Missing/undefined MUST mean enabled — every existing reader of this field
            // (MembersTab, pushService.js) treats undefined the same as `true`.
            notificationsEnabled: data['notificationsEnabled'] ?? undefined,
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
   * NEW — persists a manually drag-and-dropped member order. `orderedIds` is the full
   * member id list in its new top-to-bottom order; each member's `order` field is
   * rewritten to its index in that array in a single batch, which is exactly the same
   * field Water/Garbage rotation and every other consumer already reads — so reordering
   * here takes effect everywhere without touching any other file.
   */
  async reorderMembers(orderedIds: string[]): Promise<void> {
    const batch = writeBatch(firestoreDb);
    let touched = false;
    orderedIds.forEach((id, index) => {
      const current = this.members().find((m) => m.id === id);
      if (current && current.order !== index) {
        batch.update(doc(firestoreDb, COLLECTION, id), { order: index });
        touched = true;
      }
    });
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

  /**
   * Admin-only (enforced by Firestore rules — see firestore.rules: only the caller's own
   * admin-role doc lets this write succeed; a non-admin's request is rejected server-side
   * even if this method is somehow called from the UI). Toggles push notifications for
   * `memberId`. Does not touch FCM tokens, in-app notification/bell records, or any other
   * member's data — this only ever writes a single boolean field on one member document.
   */
  async setNotificationsEnabled(memberId: string, enabled: boolean): Promise<void> {
    await updateDoc(doc(firestoreDb, COLLECTION, memberId), { notificationsEnabled: enabled });
  }

  // ============================================================
  // PROFILE PHOTO (self-service only)
  // ============================================================
  //
  // Uses the shared CloudinaryService (unsigned upload preset), same architecture as
  // ExpenseService's bill-attachment upload — kept local to MemberService instead of
  // calling ExpenseService, since ExpenseService already injects MemberService;
  // importing it back here would create a circular dependency.

  /**
   * Validates and uploads a new profile photo for the CURRENTLY SIGNED-IN member.
   * Does not touch Firestore — call updateOwnPhoto() after to persist the resulting
   * URL/publicId. Throws on invalid file type/size/upload failure so the caller's UI
   * can show a message and never gets stuck in a "saving" state.
   */
  async uploadOwnPhoto(file: File): Promise<{ url: string; publicId: string }> {
    const uid = this.auth.user()?.uid;
    if (!uid) throw new Error('Not signed in.');

    const uploaded = await this.cloudinary.uploadFile(file, `nestly/profile-photos/${uid}`);
    return { url: uploaded.url, publicId: uploaded.publicId };
  }

  /**
   * Persists the new photo on the signed-in member's own doc. If they had a LEGACY
   * (pre-Cloudinary-migration) photo in Firebase Storage, that old file is deleted,
   * same replace pattern as before. A previous Cloudinary photo is simply no longer
   * referenced — unsigned uploads have no client-side delete (see CloudinaryService).
   */
  async updateOwnPhoto(url: string, publicId: string): Promise<void> {
    const uid = this.auth.user()?.uid;
    if (!uid) return;

    const previousLegacyPath = this.currentMember()?.photoPath;

    await updateDoc(doc(firestoreDb, COLLECTION, uid), {
      photoUrl: url,
      photoPublicId: publicId,
      photoPath: null, // any new upload replaces a legacy Storage-backed photo
    });

    if (previousLegacyPath) {
      await this.deleteLegacyPhotoFile(previousLegacyPath);
    }
  }

  /** Clears the signed-in member's own photo, and deletes the legacy Storage file, if any. */
  async removeOwnPhoto(): Promise<void> {
    const uid = this.auth.user()?.uid;
    if (!uid) return;

    const previousLegacyPath = this.currentMember()?.photoPath;

    await updateDoc(doc(firestoreDb, COLLECTION, uid), {
      photoUrl: null,
      photoPath: null,
      photoPublicId: null,
    });

    if (previousLegacyPath) {
      await this.deleteLegacyPhotoFile(previousLegacyPath);
    }
  }

  /** LEGACY ONLY — deletes a pre-Cloudinary-migration Firebase Storage photo file. */
  private async deleteLegacyPhotoFile(path: string): Promise<void> {
    try {
      await deleteObject(ref(firebaseStorage, path));
    } catch (err) {
      // Same tolerant handling as ExpenseService.deleteStorageFile — a missing/already
      // deleted file must never block the Firestore update above.
      console.warn('Could not delete legacy profile photo file', path, err);
    }
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