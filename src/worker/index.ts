import { databaseReachable } from "@/lib/db";

/**
 * The worker tick (§10). Runs every minute, from two places:
 *   - the `worker` container's loop (`src/worker/run.ts`), and
 *   - system cron hitting `/api/cron` as a safety net.
 *
 * It must be idempotent: running it twice in the same minute is normal.
 *
 * Handlers are registered here as the sprints land:
 *   S9  — outbox retries for failed WhatsApp messages (WA-03, NFR-06)
 *   S9  — driver reminders X hours before pickup (WA-04)
 *   S9  — unassigned-job alarms within 24 hours (JOB-04, NOT-03)
 *   S8  — document expiry alerts at 30/14/7 days (DOC-01)
 *   S4  — expiring abandoned quotes (BK-08)
 */
export interface TickResult {
  ok: boolean;
  ranAt: string;
  durationMs: number;
  tasks: Record<string, number>;
  errors: string[];
}

type Task = {
  name: string;
  /** Returns how many items it handled. */
  run: () => Promise<number>;
};

const tasks: Task[] = [];

/** Registered by feature modules; kept here so the tick stays a single list. */
export function registerTask(task: Task): void {
  tasks.push(task);
}

export async function runWorkerTick(): Promise<TickResult> {
  const startedAt = Date.now();
  const handled: Record<string, number> = {};
  const errors: string[] = [];

  if (!(await databaseReachable())) {
    return {
      ok: false,
      ranAt: new Date().toISOString(),
      durationMs: Date.now() - startedAt,
      tasks: {},
      errors: ["database unreachable"],
    };
  }

  for (const task of tasks) {
    try {
      handled[task.name] = await task.run();
    } catch (error) {
      // One failing task must never stop the others — a stuck reminder job
      // cannot be allowed to block WhatsApp retries (NFR-06).
      handled[task.name] = 0;
      errors.push(`${task.name}: ${error instanceof Error ? error.message : error}`);
    }
  }

  return {
    ok: errors.length === 0,
    ranAt: new Date().toISOString(),
    durationMs: Date.now() - startedAt,
    tasks: handled,
    errors,
  };
}
