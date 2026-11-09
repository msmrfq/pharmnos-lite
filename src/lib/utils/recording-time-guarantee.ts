/**
 * Exact meaning of the database-assigned recorded-time columns (recorded_at,
 * finalized_recorded_at, requested_recorded_at, completed_recorded_at).
 *
 * Each value is clock_timestamp() assigned by a BEFORE INSERT or status-transition
 * trigger while the statement executes inside a still-open transaction. That is
 * before commit, so it is not commit-visible time, not commit order, and not proof
 * of what was known at that instant. Callers cannot supply or rewrite it.
 */
export const RECORDING_TIME_GUARANTEE = "DB_STATEMENT_EXECUTION_PRE_COMMIT" as const;

export const RECORDING_TIME_DISCLOSURE =
  "Recorded time is the database server clock at statement execution inside an open transaction, before commit; it is not commit-visible time and does not prove what was known at that instant.";
