import { Component, inject } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AnnouncementService } from '../../../core/services/announcement.service';
import { Announcement } from '../../../core/models/announcement.model';
import { AnnouncementDialog } from './announcement-dialog/announcement-dialog';

@Component({
  selector: 'app-announcements-tab',
  standalone: true,
  imports: [MatIconModule, MatButtonModule, MatMenuModule],
  templateUrl: './announcements-tab.html',
  styleUrl: './announcements-tab.scss',
})
export class AnnouncementsTab {
  readonly announcementService = inject(AnnouncementService);
  private readonly dialog = inject(MatDialog);
  private readonly snackBar = inject(MatSnackBar);

  openCreate(): void {
    this.dialog.open(AnnouncementDialog, { data: {}, width: '460px', maxWidth: '95vw', autoFocus: false });
  }

  openEdit(announcement: Announcement): void {
    this.dialog.open(AnnouncementDialog, {
      data: { announcement },
      width: '460px',
      maxWidth: '95vw',
      autoFocus: false,
    });
  }

  async remove(announcement: Announcement): Promise<void> {
    const confirmed = confirm(`Delete "${announcement.title}"? This only removes it from this list.`);
    if (!confirmed) return;
    await this.announcementService.remove(announcement.id);
    this.snackBar.open('Announcement deleted.', undefined, { duration: 1800 });
  }

  timeAgo(ts: number): string {
    const mins = Math.round((Date.now() - ts) / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.round(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.round(hrs / 24);
    if (days < 30) return `${days}d ago`;
    return new Date(ts).toLocaleDateString();
  }
}
