import { Component, inject } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatBottomSheet } from '@angular/material/bottom-sheet';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TaskCalendar } from '../../shared/components/task-calendar/task-calendar';
import { MemberPickerSheet, MemberPickerData } from '../../shared/components/member-picker-sheet/member-picker-sheet';
import { MemberService } from '../../core/services/member.service';
import { WaterService } from '../../core/services/water.service';

const ACCENT = '#0288d1';

@Component({
  selector: 'app-water',
  standalone: true,
  imports: [MatIconModule, TaskCalendar],
  templateUrl: './water.html',
  styleUrl: './water.scss',
})
export class Water {
  readonly memberService = inject(MemberService);
  readonly waterService = inject(WaterService);
  private readonly bottomSheet = inject(MatBottomSheet);
  private readonly snackBar = inject(MatSnackBar);
  readonly accent = ACCENT;

  get nextMember() {
    return this.waterService.getNextMember(
      this.memberService.rotationEligibleMembers()
    );
  }

  /** Mark the currently-due member as skipped for today and auto-assign the next available one. */
  async skipMember(): Promise<void> {
    const skipped = this.nextMember;
    if (!skipped) return;

    const members = this.memberService.rotationEligibleMembers();

    const assigned = await this.waterService.skipMember(
      this.todayKey(),
      skipped.id,
      members
    );

    if (!assigned) {
      this.snackBar.open(
        'No other roommates available to reassign to.',
        'OK',
        { duration: 3000 }
      );
      return;
    }

    this.snackBar.open(
      `⏭️ ${skipped.name} skipped — reassigned to ${assigned.name}`,
      undefined,
      {
        duration: 2200,
        panelClass: 'rm-snack-success',
      }
    );
  }

  private todayKey(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  onDaySelected(evt: { dateKey: string; label: string }): void {
    const isAdmin = this.memberService.isAdmin();
    const allMembers = this.memberService.rotationEligibleMembers();

    if (!allMembers.length) {
      this.snackBar.open(
        'Add roommates in Settings first.',
        'OK',
        { duration: 3000 }
      );
      return;
    }

    // Role-based popup content: a normal member only ever sees — and can only
    // mark — their own name. Admins keep seeing (and can manage) everyone,
    // exactly as before. This only changes which members are handed to the
    // shared picker sheet; the underlying Water record model is untouched.
    const currentMember = this.memberService.currentMember();
    const members = isAdmin
      ? allMembers
      : allMembers.filter((m) => m.id === currentMember?.id);

    if (!isAdmin && !members.length) {
      this.snackBar.open(
        'Your member profile isn\u2019t set up for Water duty yet. Ask an admin.',
        'OK',
        { duration: 3500 }
      );
      return;
    }

    const existing = this.waterService.recordForDate(evt.dateKey);

    const data: MemberPickerData = {
      members,
      dateLabel: evt.label,
      selectedMemberId: existing?.memberId,
      accentColor: ACCENT,
      subtitle: isAdmin
        ? 'Tap a name to mark it done — saves instantly.'
        : 'Tap to mark yourself done — saves instantly.',
    };

    const ref = this.bottomSheet.open(MemberPickerSheet, { data });

    ref.afterDismissed().subscribe(async (memberId) => {
      if (memberId === undefined) return; // dismissed without action

      if (memberId === null) {
        await this.waterService.clearRecord(evt.dateKey);
        this.snackBar.open(
          'Entry cleared.',
          undefined,
          { duration: 1800 }
        );
        return;
      }

      await this.waterService.setRecord(evt.dateKey, memberId);

      const name = members.find((m) => m.id === memberId)?.name ?? '';

      this.snackBar.open(
        `💧 Water saved for ${name}`,
        undefined,
        {
          duration: 1800,
          panelClass: 'rm-snack-success',
        }
      );
    });
  }
}