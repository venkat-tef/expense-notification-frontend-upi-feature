export type NotificationType =
  | 'expense' | 'member_joined' | 'skip' | 'announcement'
  | 'duty_water' | 'duty_garbage' | 'settlement'
  | 'settlement_completed' | 'settlement_ready'
  | 'announcement_bell'; // NEW — bell-only, written server-side by the patched onAnnouncementCreated

export interface AppNotification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  url: string;
  /** null/undefined = broadcast to everyone. Set = only relevant to one member (e.g. duty reminder). */
  targetMemberId?: string;
  createdAt: number;
  readBy: string[];
}
