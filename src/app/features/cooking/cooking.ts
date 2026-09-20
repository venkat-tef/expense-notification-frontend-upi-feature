import { Component, inject } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatBottomSheet } from '@angular/material/bottom-sheet';
import { MatSnackBar } from '@angular/material/snack-bar';

import { TaskCalendar } from '../../shared/components/task-calendar/task-calendar';
import {
  MemberPickerSheet,
  MemberPickerData,
} from '../../shared/components/member-picker-sheet/member-picker-sheet';

import { MemberService } from '../../core/services/member.service';
import { CookingService } from '../../core/services/cooking.service';

const ACCENT = '#ef6c00';

@Component({
  selector: 'app-cooking',
  standalone: true,
  imports: [MatIconModule, TaskCalendar],
  templateUrl: './cooking.html',
  styleUrl: './cooking.scss',
})
export class Cooking {
  readonly memberService = inject(MemberService);
  readonly cookingService = inject(CookingService);

  private readonly bottomSheet = inject(MatBottomSheet);
  private readonly snackBar = inject(MatSnackBar);

  readonly accent = ACCENT;

  /**
   * Current garbage-duty member.
   *
   * This is the member whose artwork should be displayed.
   */
  get nextMember() {
    return this.cookingService.getNextMember(
      this.memberService.rotationEligibleMembers()
    );
  }

  get calendarRecords() {
  return this.cookingService.records().filter(
    (record) => !record.skippedMemberIds?.length
  );
}

  /**
   * Select the correct garbage-duty artwork
   * based on today's currently assigned member.
   *
   * Example:
   * Narendra -> narendra-duty.png
   * Madan    -> madan-duty.png
   * Jagan    -> jagan-duty.png
   * Venki    -> venki-duty.png
   */
  get dutySceneSrc(): string {
    const name = this.nextMember?.name
      ?.trim()
      .toLowerCase();

    switch (name) {
      case 'venki':
        return 'assets/venki-duty.png';

      case 'madan':
        return 'assets/madan-duty.png';

      case 'narendra':
        return 'assets/narendra-duty.png';

      case 'jagan':
        return 'assets/jagan-duty.png';

      default:
        return 'assets/narendra-duty.png';
    }
  }

  /**
   * Whether today's garbage duty has already been completed.
   */
get dutyCompletedToday(): boolean {
  const record =
    this.cookingService.recordForDate(
      this.todayKey()
    );

  return !!record &&
    !record.skippedMemberIds?.length;
}

  /**
   * Text shown below the garbage-duty artwork.
   */
  get dutyStageComment(): string {
    const next = this.nextMember;

    if (!next) {
      return 'Nobody escaped the rota today 😂';
    }

    return this.dutyCompletedToday
      ? `🎉 ${next.name} is next!`
      : `👀 Even garbage deserves a hero… today it's ${next.name}! 😂`;
  }

  /**
   * Mark today's assigned member as having completed garbage duty.
   */
  async markTodayCollected(): Promise<void> {
    const assigned = this.nextMember;

    const allMembers =
      this.memberService.rotationEligibleMembers();

    if (!assigned || !allMembers.length) {
      this.snackBar.open(
        'Add roommates in Settings first.',
        'OK',
        {
          duration: 3000,
        }
      );

      return;
    }

    const isAdmin =
      this.memberService.isAdmin();

    const currentMember =
      this.memberService.currentMember();

    /**
     * Non-admin users can only complete
     * their own garbage duty.
     */
    if (
      !isAdmin &&
      currentMember?.id !== assigned.id
    ) {
      this.snackBar.open(
        `Today is ${assigned.name}'s Garbage turn.`,
        'OK',
        {
          duration: 3000,
        }
      );

      return;
    }

    await this.cookingService.setRecord(
      this.todayKey(),
      assigned.id
    );

    this.snackBar.open(
      `🗑️ Garbage saved for ${assigned.name}`,
      undefined,
      {
        duration: 1800,
        panelClass: 'rm-snack-success',
      }
    );
  }

  /**
   * Skip the currently assigned member
   * and reassign garbage duty.
   *
   * After reassignment, nextMember changes,
   * so dutySceneSrc automatically displays
   * the new person's artwork.
   */
async skipMember(): Promise<void> {
  const today = this.todayKey();

  const record = this.cookingService.recordForDate(today);

  const skipped = record
    ? this.memberService.members().find(
        (m) => m.id === record.memberId
      ) ?? this.nextMember
    : this.nextMember;

  if (!skipped) return;

  const members =
    this.memberService.rotationEligibleMembers();

  const assigned =
    await this.cookingService.skipMember(
      today,
      skipped.id,
      members,
      record?.skippedMemberIds ?? []
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

  /**
   * Return today's date in YYYY-MM-DD format.
   */
  private todayKey(): string {
    const d = new Date();

    return `${d.getFullYear()}-${String(
      d.getMonth() + 1
    ).padStart(2, '0')}-${String(
      d.getDate()
    ).padStart(2, '0')}`;
  }

  /**
   * Handle calendar day selection.
   */
  onDaySelected(evt: {
    dateKey: string;
    label: string;
  }): void {
    const isAdmin =
      this.memberService.isAdmin();

    const allMembers =
      this.memberService.rotationEligibleMembers();

    if (!allMembers.length) {
      this.snackBar.open(
        'Add roommates in Settings first.',
        'OK',
        {
          duration: 3000,
        }
      );

      return;
    }

    const currentMember =
      this.memberService.currentMember();

    /**
     * Admin can select anyone.
     * Normal member can only select themselves.
     */
    const members = isAdmin
      ? allMembers
      : allMembers.filter(
          (m) => m.id === currentMember?.id
        );

    if (!isAdmin && !members.length) {
      this.snackBar.open(
        'Your member profile isn’t set up for Garbage duty yet. Ask an admin.',
        'OK',
        {
          duration: 3500,
        }
      );

      return;
    }

    const existing =
      this.cookingService.recordForDate(
        evt.dateKey
      );

    const data: MemberPickerData = {
      members,

      dateLabel: evt.label,

      selectedMemberId:
        existing?.memberId,

      accentColor: ACCENT,

      subtitle: isAdmin
        ? 'Tap a name to mark it done — saves instantly.'
        : 'Tap to mark yourself done — saves instantly.',
    };

    const ref =
      this.bottomSheet.open(
        MemberPickerSheet,
        {
          data,
        }
      );

    ref.afterDismissed().subscribe(
      async (memberId) => {
        /**
         * User closed the sheet.
         */
        if (memberId === undefined) {
          return;
        }

        /**
         * Clear existing record.
         */
        if (memberId === null) {
          await this.cookingService.clearRecord(
            evt.dateKey
          );

          this.snackBar.open(
            'Entry cleared.',
            undefined,
            {
              duration: 1800,
            }
          );

          return;
        }

        /**
         * Save selected member.
         */
        await this.cookingService.setRecord(
          evt.dateKey,
          memberId
        );

        const name =
          members.find(
            (m) => m.id === memberId
          )?.name ?? '';

        this.snackBar.open(
          `🗑️ Garbage saved for ${name}`,
          undefined,
          {
            duration: 1800,
            panelClass: 'rm-snack-success',
          }
        );
      }
    );
  }
}