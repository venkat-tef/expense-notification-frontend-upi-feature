export interface TaskRecord {
  /** Document id. We use the date string (YYYY-MM-DD) as the id so each date has exactly one entry (upsert). */
  id: string;
  /** Date in YYYY-MM-DD format */
  date: string;
  memberId: string;
  createdAt: number;
  /**
   * Set when the member originally due for this date was unavailable and got skipped.
   * `memberId` above is whoever was auto-assigned instead. Only affects this date's
   * record — the skipped member remains in the normal rotation for future turns.
   */
  skippedMemberId?: string;
}

export interface MemberStat {
  memberId: string;
  memberName: string;
  count: number;
}
