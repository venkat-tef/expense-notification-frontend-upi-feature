export type MemberRole = 'admin' | 'member' | 'guest';
export type MemberStatus = 'active' | 'inactive';

export interface Member {
  id: string;
  name: string;
  order: number;
  createdAt: number;

  // New optional fields. Existing members without these keep working exactly as before —
  // Water Duty, Garbage Duty, Expenses, and History only ever read `name`.
  uid?: string;
  email?: string;
  phone?: string;
  role?: MemberRole;
  status?: MemberStatus;

  // UPI Settlement feature — also optional, same backwards-compat reasoning as above.
  /** e.g. "venkat@okhdfcbank". Set by the member themselves from Settings. */
  upiId?: string;
  /** Only one member should have this true at a time — enforced by MemberService.setPaymentApprover(). */
  isPaymentApprover?: boolean;

  /**
   * Admin-controlled push notification toggle. Optional/undefined MUST be treated as
   * enabled everywhere it's read (frontend and backend) — this is what keeps every
   * existing member's push behavior unchanged after this field is introduced.
   * Only an admin may change another member's value (enforced by firestore.rules).
   */
  notificationsEnabled?: boolean;
}

/** Input shape for creating a brand-new member with a login account. */
export interface NewMemberInput {
  name: string;
  email: string;
  tempPassword: string;
  phone?: string;
  role: MemberRole;
  status: MemberStatus;
}

/** Input shape for editing an existing member. Email/password are never editable here. */
export interface MemberUpdateInput {
  name: string;
  phone?: string;
  role: MemberRole;
  status: MemberStatus;
}

/** Input shape for the self-service "My UPI ID" editor in Settings. */
export interface UpiIdUpdateInput {
  upiId: string;
}