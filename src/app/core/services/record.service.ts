import { inject, signal } from '@angular/core';
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore';
import { firestoreDb } from './firebase';
import { Member } from '../models/member.model';
import { MemberStat, TaskRecord } from '../models/record.model';
import { NotificationService } from './notification.service';

/**
 * Base class shared by WaterService and CookingService.
 * Each date has exactly one record, stored with the date string as the
 * document id, so tapping a member is a simple upsert -> instant, no
 * submit button, no duplicates.
 */
export abstract class RecordServiceBase {
  readonly records = signal<TaskRecord[]>([]);
  readonly loaded = signal(false);

  private readonly notifications = inject(NotificationService);

  protected constructor(private readonly collectionName: string, private readonly dutyLabel: string) {
    this.listen();
  }

  private listen(): void {
    const q = query(collection(firestoreDb, this.collectionName), orderBy('date', 'desc'));
    onSnapshot(
      q,
      (snap) => {
        const list: TaskRecord[] = snap.docs.map((d) => {
          const data = d.data() as any;
          return {
            id: d.id,
            date: data['date'],
            memberId: data['memberId'],
            createdAt: data['createdAt']?.toMillis?.() ?? Date.now(),
            skippedMemberIds:
              data['skippedMemberIds'] ??
              (data['skippedMemberId'] ? [data['skippedMemberId']] : undefined),
          };
        });
        this.records.set(list);
        this.loaded.set(true);
      },
      (err) => {
        console.error(`${this.collectionName} onSnapshot error`, err);
        this.loaded.set(true);
      }
    );
  }

  /**
   * Auto-saves the selected member for a given date (YYYY-MM-DD). Upsert, no submit needed.
   * Pass `skippedMemberIds` when this assignment is a reassignment after skipping one or
   * more members who were originally due — omit it (or pass an empty array) for a normal
   * (non-skip) assignment, which clears any previous skip flags on that date.
   */
  async setRecord(dateKey: string, memberId: string, skippedMemberIds?: string[]): Promise<void> {
    const data: Record<string, unknown> = {
      date: dateKey,
      memberId,
      createdAt: serverTimestamp(),
    };
    if (skippedMemberIds && skippedMemberIds.length) {
      data['skippedMemberIds'] = skippedMemberIds;
    }
    await setDoc(doc(firestoreDb, this.collectionName, dateKey), data);
  }

  /**
   * Member after `memberId` in rotation order, skipping anyone listed in `exclude`
   * (wraps around). Returns undefined only if every member is excluded (nobody left to
   * assign to).
   */
  nextAfter(members: Member[], memberId: string, exclude: string[] = []): Member | undefined {
    if (!members.length) return undefined;
    const startIdx = members.findIndex((m) => m.id === memberId);
    const start = startIdx === -1 ? 0 : startIdx;
    for (let step = startIdx === -1 ? 0 : 1; step <= members.length; step++) {
      const candidate = members[(start + step) % members.length];
      if (!exclude.includes(candidate.id)) return candidate;
    }
    return undefined;
  }

  /**
   * Marks `skippedMemberId` (plus anyone already skipped earlier today, via
   * `alreadySkippedIds`) as skipped for `dateKey` and auto-assigns the next available
   * member in rotation for that date instead — walking past every already-skipped member,
   * so this supports skipping 2, 3, or more roommates in a row on the same day, not just
   * one. Only that date's record is affected — skipped members are not removed from
   * future rotation, since the next-turn calculation always continues from whoever was
   * actually recorded.
   * Returns the newly assigned member, or undefined if literally everyone in rotation has
   * been skipped for that date (nobody left to assign to).
   * Also notifies every member that the skip happened (Feature 7).
   */
  async skipMember(
    dateKey: string,
    skippedMemberId: string,
    members: Member[],
    alreadySkippedIds: string[] = []
  ): Promise<Member | undefined> {
    const allSkipped = alreadySkippedIds.includes(skippedMemberId)
      ? alreadySkippedIds
      : [...alreadySkippedIds, skippedMemberId];

    const assigned = this.nextAfter(members, skippedMemberId, allSkipped);
    if (!assigned) return undefined;
    await this.setRecord(dateKey, assigned.id, allSkipped);

    const skippedNames = members
      .filter((m) => allSkipped.includes(m.id))
      .map((m) => m.name);
    const skippedLabel =
      skippedNames.length > 1
        ? `${skippedNames.slice(0, -1).join(', ')} and ${skippedNames[skippedNames.length - 1]}`
        : skippedNames[0] ?? 'Someone';

    await this.notifications.notify(
      'skip',
      `${this.dutyLabel} Turn Skipped`,
      `${skippedLabel} skipped today's ${this.dutyLabel} Turn. ${assigned.name} has been assigned automatically.`,
      this.dutyLabel === 'Water' ? '/water' : '/cooking'
    );

    return assigned;
  }

  async clearRecord(dateKey: string): Promise<void> {
    await deleteDoc(doc(firestoreDb, this.collectionName, dateKey));
  }

  recordForDate(dateKey: string): TaskRecord | undefined {
    return this.records().find((r) => r.date === dateKey);
  }

  /** Most recent record chronologically (records are already sorted desc by date). */
  getLastRecord(): TaskRecord | undefined {
    return this.records()[0];
  }

  /** Round-robin: whoever comes after the last recorded member, in member order. */
  getNextMember(members: Member[]): Member | undefined {
    if (!members.length) return undefined;
    const last = this.getLastRecord();
    if (!last) return members[0];
    const idx = members.findIndex((m) => m.id === last.memberId);
    if (idx === -1) return members[0];
    return members[(idx + 1) % members.length];
  }

  getStats(members: Member[]): MemberStat[] {
    const counts = new Map<string, number>();
    for (const r of this.records()) {
      counts.set(r.memberId, (counts.get(r.memberId) ?? 0) + 1);
    }
    return members
      .map((m) => ({ memberId: m.id, memberName: m.name, count: counts.get(m.id) ?? 0 }))
      .sort((a, b) => b.count - a.count);
  }
}