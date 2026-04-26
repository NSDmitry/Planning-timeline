import { computeTaskPhaseSchedule, isReviewPhase } from '../conflicts';
import type { Person, SprintEvent, Task } from '../types';

interface Props {
  tasks: Task[];
  people: Person[];
  events: SprintEvent[];
  startDate: string;
}

function parseISODateLocal(iso: string): Date {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1, 12);
}

function addDaysISO(iso: string, days: number): string {
  const date = parseISODateLocal(iso);
  date.setDate(date.getDate() + days);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatShortDate(iso: string): string {
  return parseISODateLocal(iso).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'short',
  });
}

function dayPositionToISO(startDate: string, dayPosition: number): string {
  const safeDayIndex = Math.max(0, Math.ceil(dayPosition) - 1);
  return addDaysISO(startDate, safeDayIndex);
}

function formatPhaseDate(startDate: string, dayPosition: number, isEnd = false): string {
  return formatShortDate(dayPositionToISO(startDate, Math.max(1, isEnd ? dayPosition : dayPosition + 1)));
}

function normalizeText(value: string): string {
  return value.trim().toLowerCase();
}

function isDevPhase(label: string): boolean {
  const normalized = normalizeText(label);
  return (
    normalized === 'dev' ||
    normalized === 'development' ||
    normalized.includes('разраб') ||
    normalized.includes('разработ')
  );
}

function isTestPhase(label: string): boolean {
  const normalized = normalizeText(label);
  return (
    normalized === 'test' ||
    normalized === 'qa' ||
    normalized.includes('тест') ||
    normalized.includes('qa')
  );
}

function formatDaysCount(days: number): string {
  const rounded = Math.round(days * 10) / 10;
  return `${Number.isInteger(rounded) ? rounded : rounded.toLocaleString('ru-RU')} дн.`;
}

function getPersonName(people: Person[], personId: string): string {
  return people.find(person => person.id === personId)?.name ?? 'Не назначен';
}

function getTaskHref(task: Task): string | null {
  const link = task.link?.trim();
  if (!link) return null;
  if (/^https?:\/\//i.test(link)) return link;
  return `https://${link}`;
}

interface ReportPhaseLine {
  title: string;
  assignee: string;
  start: string;
  end: string;
}

interface ReportDates {
  phases: ReportPhaseLine[];
  total: {
    start: string;
    end: string;
    days: string;
  } | null;
}

function getTaskDates(task: Task, people: Person[], startDate: string, events: SprintEvent[]): ReportDates {
  const scheduledPhases = computeTaskPhaseSchedule(task, startDate, events);
  const scheduleByPhaseId = new Map(scheduledPhases.map(item => [item.phaseId, item] as const));

  const makeLine = (
    title: string,
    predicate: (label: string) => boolean,
    showAssignee: boolean
  ): ReportPhaseLine => {
    const phase = task.phases.find(item => item.durationDays > 0 && predicate(item.label));
    if (!phase) return { title, assignee: showAssignee ? 'Нет фазы' : '', start: '—', end: '—' };

    const scheduled = scheduleByPhaseId.get(phase.id);
    return {
      title,
      assignee: showAssignee
        ? phase.assigneeId ? getPersonName(people, phase.assigneeId) : 'Не назначен'
        : '',
      start: scheduled ? formatPhaseDate(startDate, scheduled.startDay) : '—',
      end: scheduled ? formatPhaseDate(startDate, scheduled.endDay, true) : '—',
    };
  };

  const activePhases = task.phases.filter(phase => phase.durationDays > 0);
  const totalStart = scheduledPhases.length > 0 ? Math.min(...scheduledPhases.map(phase => phase.startDay)) : null;
  const totalEnd = scheduledPhases.length > 0 ? Math.max(...scheduledPhases.map(phase => phase.endDay)) : null;
  const totalDays = activePhases.reduce((sum, phase) => sum + phase.durationDays, 0);

  return {
    phases: [
      makeLine('Dev', isDevPhase, true),
      makeLine('Review', isReviewPhase, false),
      makeLine('Test', isTestPhase, true),
    ],
    total: totalStart === null || totalEnd === null
      ? null
      : {
          start: formatPhaseDate(startDate, totalStart),
          end: formatPhaseDate(startDate, totalEnd, true),
          days: formatDaysCount(totalDays),
        },
  };
}

export function SprintReport({ tasks, people, events, startDate }: Props) {
  const rows = tasks
    .map((task, index) => ({
      task,
      index,
      href: getTaskHref(task),
      dates: getTaskDates(task, people, startDate, events),
    }))
    .sort((a, b) => {
      if (a.task.sprintGoal !== b.task.sprintGoal) return a.task.sprintGoal ? -1 : 1;
      return a.index - b.index;
    });

  return (
    <main className="flex-1 overflow-auto bg-slate-50">
      <div className="mx-auto max-w-6xl px-5 py-5">
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <h1 className="text-xl font-semibold text-slate-900">Отчет по спринту</h1>
            <p className="mt-1 text-sm text-slate-500">{tasks.length} задач в текущем спринте</p>
          </div>
        </div>

        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
          <table className="w-full min-w-[720px] border-collapse text-left text-sm">
            <thead className="bg-slate-100 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="w-[38%] px-4 py-3 font-semibold">Задача</th>
                <th className="px-4 py-3 font-semibold">Даты</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.length === 0 ? (
                <tr>
                  <td className="px-4 py-10 text-center text-slate-400" colSpan={2}>
                    В этом спринте пока нет задач.
                  </td>
                </tr>
              ) : rows.map(row => (
                <tr key={row.task.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 align-top font-medium text-slate-800">
                    <div className="flex flex-col gap-1.5">
                      {row.task.sprintGoal && (
                        <span className="w-fit rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
                          Цель спринта
                        </span>
                      )}
                      <span>{row.task.name}</span>
                      {row.href && (
                        <a
                          href={row.href}
                          target="_blank"
                          rel="noreferrer"
                          className="break-all text-xs font-normal text-cyan-700 hover:text-cyan-900 hover:underline"
                        >
                          {row.task.link?.trim()}
                        </a>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 align-top text-slate-700">
                    {!row.dates.total ? (
                      <span className="text-slate-400">Фазы не запланированы</span>
                    ) : (
                      <div className="flex flex-col gap-2">
                        {row.dates.phases.map(phase => (
                          <div key={phase.title} className="grid grid-cols-[5rem_minmax(0,1fr)_6rem_6rem] items-baseline gap-3 rounded-md bg-slate-50 px-3 py-2">
                            <span className="font-medium text-slate-800">{phase.title}</span>
                            <span className="min-w-0 truncate text-slate-500">{phase.assignee}</span>
                            <span className="whitespace-nowrap text-slate-700">{phase.start}</span>
                            <span className="whitespace-nowrap text-slate-700">{phase.end}</span>
                          </div>
                        ))}
                        <div className="grid grid-cols-[5rem_minmax(0,1fr)_6rem_6rem] items-baseline gap-3 rounded-md border border-cyan-100 bg-cyan-50 px-3 py-2">
                          <span className="font-semibold text-cyan-900">Общее</span>
                          <span className="min-w-0 truncate text-cyan-700">{row.dates.total.days}</span>
                          <span className="whitespace-nowrap text-cyan-900">{row.dates.total.start}</span>
                          <span className="whitespace-nowrap text-cyan-900">{row.dates.total.end}</span>
                        </div>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
