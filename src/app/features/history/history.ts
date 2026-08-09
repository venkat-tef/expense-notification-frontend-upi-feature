
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTableModule } from '@angular/material/table';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MemberService } from '../../core/services/member.service';
import { WaterService } from '../../core/services/water.service';
import { CookingService } from '../../core/services/cooking.service';
import { TaskRecord } from '../../core/models/record.model';

interface HistoryRow {
  id: string;
  date: string;
  memberName: string;
  skippedMemberName?: string;
  createdLabel: string;
}

@Component({
  selector: 'app-history',
  standalone: true,
  imports: [
    FormsModule,
    MatTabsModule,
    MatTableModule,
    MatFormFieldModule,
    MatSelectModule,
    MatInputModule,
    MatIconModule,
  ],
  templateUrl: './history.html',
  styleUrl: './history.scss',
})
export class History {
  readonly memberService = inject(MemberService);
  readonly waterService = inject(WaterService);
  readonly cookingService = inject(CookingService);

  readonly displayedColumns = ['date', 'member', 'skipped', 'created'];

  readonly waterMonth = signal('all');
  readonly waterSearch = signal('');
  readonly cookingMonth = signal('all');
  readonly cookingSearch = signal('');

  readonly waterMonthOptions = computed(() =>
    this.monthOptions(this.waterService.records())
  );

  readonly cookingMonthOptions = computed(() =>
    this.monthOptions(this.cookingService.records())
  );

  readonly waterRows = computed(() =>
    this.buildRows(
      this.waterService.records(),
      this.waterMonth(),
      this.waterSearch()
    )
  );

  readonly cookingRows = computed(() =>
    this.buildRows(
      this.cookingService.records(),
      this.cookingMonth(),
      this.cookingSearch()
    )
  );

  // Only rotation-eligible members are included in duty-count summaries.
  readonly waterStats = computed(() =>
    this.waterService.getStats(
      this.memberService.rotationEligibleMembers()
    )
  );

  readonly cookingStats = computed(() =>
    this.cookingService.getStats(
      this.memberService.rotationEligibleMembers()
    )
  );

  private monthOptions(
    records: TaskRecord[]
  ): { value: string; label: string }[] {
    const set = new Set(records.map((r) => r.date.slice(0, 7)));

    return Array.from(set)
      .sort((a, b) => (a < b ? 1 : -1))
      .map((ym) => ({
        value: ym,
        label: new Date(`${ym}-01T00:00:00`).toLocaleDateString('en-US', {
          month: 'long',
          year: 'numeric',
        }),
      }));
  }

  private buildRows(
    records: TaskRecord[],
    month: string,
    search: string
  ): HistoryRow[] {
    // `records` is already ordered newest-first (Firestore query: orderBy('date', 'desc')).

    // IMPORTANT: Keep members() here.
    // This is a historical name lookup, so guest names from past records
    // must continue to display correctly.
    const memberMap = new Map(
      this.memberService.members().map((m) => [m.id, m.name])
    );

    const q = search.trim().toLowerCase();

    return records
      .filter((r) => month === 'all' || r.date.startsWith(month))
      .map((r) => ({
        id: r.id,
        date: new Date(`${r.date}T00:00:00`).toLocaleDateString('en-US', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        }),
        memberName: memberMap.get(r.memberId) ?? 'Unknown',
        skippedMemberName: r.skippedMemberId
          ? memberMap.get(r.skippedMemberId) ?? 'Unknown'
          : undefined,
        createdLabel: new Date(r.createdAt).toLocaleString('en-US', {
          day: '2-digit',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit',
        }),
      }))
      .filter((r) => !q || r.memberName.toLowerCase().includes(q));
  }
}

