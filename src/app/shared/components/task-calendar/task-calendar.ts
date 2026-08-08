import { Component, computed, input, output, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { Member } from '../../../core/models/member.model';
import { TaskRecord } from '../../../core/models/record.model';

interface CalendarDay {
  date: Date;
  dateKey: string;
  inMonth: boolean;
  isToday: boolean;
  isFuture: boolean;
  record?: TaskRecord;
  memberInitial?: string;
  memberName?: string;
}

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function toDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

@Component({
  selector: 'app-task-calendar',
  standalone: true,
  imports: [MatIconModule],
  templateUrl: './task-calendar.html',
  styleUrl: './task-calendar.scss',
})
export class TaskCalendar {
  readonly members = input.required<Member[]>();
  readonly records = input.required<TaskRecord[]>();
  readonly accentColor = input<string>('#00897b');

  readonly daySelected = output<{ dateKey: string; label: string }>();

  readonly weekdays = WEEKDAYS;
  readonly viewDate = signal(this.startOfMonth(new Date()));

  readonly monthLabel = computed(() =>
    this.viewDate().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  );

  readonly canGoNext = computed(() => {
    const today = this.startOfMonth(new Date());
    return this.viewDate().getTime() < today.getTime();
  });

  readonly weeks = computed<CalendarDay[][]>(() => {
    const view = this.viewDate();
    const recordMap = new Map(this.records().map((r) => [r.date, r]));
    const memberMap = new Map(this.members().map((m) => [m.id, m]));
    const today = toDateKey(new Date());

    const first = new Date(view.getFullYear(), view.getMonth(), 1);
    const startOffset = first.getDay();
    const gridStart = new Date(first);
    gridStart.setDate(first.getDate() - startOffset);

    const days: CalendarDay[] = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(gridStart);
      d.setDate(gridStart.getDate() + i);
      const dateKey = toDateKey(d);
      const record = recordMap.get(dateKey);
      const member = record ? memberMap.get(record.memberId) : undefined;
      days.push({
        date: d,
        dateKey,
        inMonth: d.getMonth() === view.getMonth(),
        isToday: dateKey === today,
        isFuture: dateKey > today,
        record,
        memberInitial: member?.name?.charAt(0)?.toUpperCase(),
        memberName: member?.name,
      });
    }

    const weeks: CalendarDay[][] = [];
    for (let i = 0; i < 6; i++) {
      weeks.push(days.slice(i * 7, i * 7 + 7));
    }
    // Drop a trailing all-out-of-month week for a tighter calendar.
    if (weeks.length && weeks[weeks.length - 1].every((d) => !d.inMonth)) {
      weeks.pop();
    }
    return weeks;
  });

  private startOfMonth(d: Date): Date {
    return new Date(d.getFullYear(), d.getMonth(), 1);
  }

  prevMonth(): void {
    const v = this.viewDate();
    this.viewDate.set(new Date(v.getFullYear(), v.getMonth() - 1, 1));
  }

  nextMonth(): void {
    if (!this.canGoNext()) return;
    const v = this.viewDate();
    this.viewDate.set(new Date(v.getFullYear(), v.getMonth() + 1, 1));
  }

  selectDay(day: CalendarDay): void {
    if (day.isFuture) return;
    const label = day.date.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    });
    this.daySelected.emit({ dateKey: day.dateKey, label });
  }
}
