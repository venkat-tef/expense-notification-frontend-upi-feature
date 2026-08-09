export type AnnouncementStatus = 'active' | 'inactive';

export interface Announcement {
  id: string;
  title: string;
  body: string;
  status: AnnouncementStatus;
  createdAt: number;
  updatedAt: number;
  createdByName?: string;
}

export interface AnnouncementInput {
  title: string;
  body: string;
  status: AnnouncementStatus;
}
