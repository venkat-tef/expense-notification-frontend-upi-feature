import { Component, inject } from '@angular/core';
import { MatBottomSheetModule, MatBottomSheetRef, MAT_BOTTOM_SHEET_DATA } from '@angular/material/bottom-sheet';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { Member } from '../../../core/models/member.model';

export interface MemberPickerData {
  members: Member[];
  dateLabel: string;
  selectedMemberId?: string;
  accentColor: string;
  /**
   * Optional override for the sheet's helper text under the title. Lets callers
   * explain role-based behavior (e.g. "Tap to mark yourself done" for a member
   * who only sees their own name vs. the default "Tap a name..." admins see
   * with the full roommate list). Falls back to the original copy when omitted,
   * so every existing caller keeps working unchanged.
   */
  subtitle?: string;
}

@Component({
  selector: 'app-member-picker-sheet',
  standalone: true,
  imports: [MatBottomSheetModule, MatIconModule, MatListModule],
  templateUrl: './member-picker-sheet.html',
  styleUrl: './member-picker-sheet.scss',
})
export class MemberPickerSheet {
  private readonly sheetRef = inject(MatBottomSheetRef<MemberPickerSheet, string | null>);
  readonly data = inject<MemberPickerData>(MAT_BOTTOM_SHEET_DATA);

  /** Tapping a member auto-saves immediately — no submit button. */
  select(memberId: string): void {
    this.sheetRef.dismiss(memberId);
  }

  clear(): void {
    this.sheetRef.dismiss(null);
  }
}