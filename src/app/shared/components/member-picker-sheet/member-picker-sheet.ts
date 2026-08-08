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
