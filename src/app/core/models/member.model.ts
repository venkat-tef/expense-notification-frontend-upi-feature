

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
