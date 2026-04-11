import type { Task, PhaseBlock, DayLoad } from './types';

export const HOURS_PER_DAY = 8;

function isWeekend(startDate: string, dayIndex: number): boolean {
  const date = new Date(startDate);
  date.setDate(date.getDate() + dayIndex);
  const dow = date.getDay();
  return dow === 0 || dow === 6;
}

// If dayPos lands on a weekend, snap forward to start of next working day
function snapToWorkingDay(startDate: string, dayPos: number): number {
  let dayIdx = Math.floor(dayPos);
  if (isWeekend(startDate, dayIdx)) {
    dayIdx++;
    while (isWeekend(startDate, dayIdx)) dayIdx++;
    return dayIdx; // snapped to integer start of working day
  }
  return dayPos; // keep fractional if already on a working day
}

// Advance `workingDays` (fractional) working-day capacity from startDay (fractional).
// Weekends are skipped entirely. Returns end position as fractional day.
function calcEndDay(startDate: string, startDay: number, workingDays: number): number {
  let pos = startDay;
  let remaining = workingDays;

  while (remaining > 1e-9) {
    const dayIdx = Math.floor(pos);
    if (isWeekend(startDate, dayIdx)) {
      pos = dayIdx + 1; // skip to start of next day
      continue;
    }
    const fracInDay = pos - dayIdx;          // how far into the current day (0–1)
    const capacityLeft = 1 - fracInDay;      // remaining capacity of current day
    if (remaining <= capacityLeft) {
      pos += remaining;
      remaining = 0;
    } else {
      remaining -= capacityLeft;
      pos = dayIdx + 1; // move to start of next day
    }
  }

  return pos;
}

export { isWeekend, snapToWorkingDay };

const TASK_COLORS = [
  '#3b82f6', '#8b5cf6', '#f59e0b', '#22c55e',
  '#ef4444', '#ec4899', '#14b8a6', '#f97316', '#6366f1',
];

export function computePhaseBlocks(tasks: Task[], startDate: string): PhaseBlock[] {
  const blocks: Omit<PhaseBlock, 'hasConflict'>[] = [];

  tasks.forEach((task, taskIdx) => {
    const taskColor = task.color ?? TASK_COLORS[taskIdx % TASK_COLORS.length];
    let cursor = snapToWorkingDay(startDate, task.startDay);
    let lastAssigneeId = '';

    for (const phase of task.phases) {
      if (phase.durationDays <= 0) continue;
      cursor = snapToWorkingDay(startDate, cursor);

      const phaseStart = cursor;
      const phaseEnd = calcEndDay(startDate, phaseStart, phase.durationDays);

      const hasAssignee = !!phase.assigneeId;
      const displayAssigneeId = hasAssignee ? phase.assigneeId : lastAssigneeId;

      if (displayAssigneeId) {
        blocks.push({
          taskId: task.id,
          taskName: task.name,
          taskColor,
          phaseId: phase.id,
          phaseLabel: phase.label,
          assigneeId: displayAssigneeId,
          startDay: phaseStart,
          endDay: phaseEnd,
          isExternal: !hasAssignee,
        });
      }

      if (hasAssignee) lastAssigneeId = phase.assigneeId;
      cursor = phaseEnd;
    }
  });

  // Conflict detection — only non-external blocks
  const conflictPhaseIds = new Set<string>();
  const byAssignee = new Map<string, typeof blocks>();
  for (const b of blocks) {
    if (!b.assigneeId || b.isExternal) continue;
    if (!byAssignee.has(b.assigneeId)) byAssignee.set(b.assigneeId, []);
    byAssignee.get(b.assigneeId)!.push(b);
  }
  for (const [, ab] of byAssignee) {
    for (let i = 0; i < ab.length; i++) {
      for (let j = i + 1; j < ab.length; j++) {
        const a = ab[i], b = ab[j];
        if (a.startDay < b.endDay && b.startDay < a.endDay) {
          conflictPhaseIds.add(a.phaseId);
          conflictPhaseIds.add(b.phaseId);
        }
      }
    }
  }

  return blocks.map(b => ({ ...b, hasConflict: conflictPhaseIds.has(b.phaseId) }));
}

// External blocks don't count toward load
export function computePersonLoad(
  personId: string,
  blocks: PhaseBlock[],
  totalDays: number
): DayLoad[] {
  const load = Array<number>(totalDays).fill(0);
  for (const b of blocks) {
    if (b.assigneeId !== personId || b.isExternal) continue;
    // Count each calendar day this block overlaps (fractional)
    const start = Math.floor(b.startDay);
    const end = Math.ceil(b.endDay);
    for (let d = start; d < end && d < totalDays; d++) {
      load[d]++;
    }
  }
  return load.map(n => (n === 0 ? 0 : n === 1 ? 1 : 2)) as DayLoad[];
}

// Helpers for UI
export function daysToHours(days: number): number {
  return Math.round(days * HOURS_PER_DAY);
}
export function hoursToDays(hours: number): number {
  return hours / HOURS_PER_DAY;
}
export function formatDuration(days: number): string {
  const h = Math.round(days * HOURS_PER_DAY);
  if (h < HOURS_PER_DAY) return `${h}ч`;
  const d = Math.floor(h / HOURS_PER_DAY);
  const rem = h % HOURS_PER_DAY;
  return rem > 0 ? `${d}д ${rem}ч` : `${d}д`;
}
