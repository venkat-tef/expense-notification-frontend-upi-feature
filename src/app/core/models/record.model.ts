export interface TaskRecord {
  /** Document id. We use the date string (YYYY-MM-DD) as the id so each date has exactly one entry (upsert). */
  id: string;
  /** Date in YYYY-MM-DD format */
  date: string;
  memberId: string;
  createdAt: number;
  /**
   * Members who were originally due for this date but were unavailable and got skipped,
   * in the order they were skipped. `memberId` above is whoever was finally auto-assigned
   * after skipping through all of them — supports skipping 2, 3, or more roommates in a
   * row on the same day, not just one. Only affects this date's record — skipped members
   * remain in the normal rotation for future turns.
   */
  skippedMemberIds?: string[];
}

export interface MemberStat {
  memberId: string;
  memberName: string;
  count: number;
}