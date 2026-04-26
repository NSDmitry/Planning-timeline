import { useState, useRef } from 'react';
import type { Task, Phase, Person, SprintEvent } from '../types';
import { Modal } from './Modal';
import { generateId } from '../store';
import { daysToHours, hoursToDays, formatDuration, HOURS_PER_DAY, computeTaskPhaseSchedule, isReviewPhase } from '../conflicts';

interface Props {
  task: Task | null;
  people: Person[];
  sprintDays: number;
  startDate: string;
  events?: SprintEvent[];
  initialStartDay?: number | null;
  initialAssigneeId?: string | null;
  onSave: (task: Task) => void;
  onDelete?: (id: string) => void;
  onClose: () => void;
}

const DEFAULT_PHASE_LABELS = ['Dev', 'Review', 'Test'];

type PhaseRoleKind = 'dev' | 'test' | null;

function emptyPhase(label: string): Phase {
  return { id: generateId(), label, assigneeId: '', durationDays: 1 };
}

function parseISODateLocal(iso: string): Date {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1, 12);
}

function formatISODateLocal(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function addDaysISO(iso: string, days: number): string {
  const date = parseISODateLocal(iso);
  date.setDate(date.getDate() + days);
  return formatISODateLocal(date);
}

function diffDaysISO(fromISO: string, toISO: string): number {
  const from = parseISODateLocal(fromISO);
  const to = parseISODateLocal(toISO);
  return Math.round((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000));
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function formatHours(hours: number): string {
  const d = Math.floor(hours / HOURS_PER_DAY);
  const h = hours % HOURS_PER_DAY;
  if (d > 0 && h > 0) return `${d}d ${h}h`;
  if (d > 0) return `${d}d`;
  return `${h}h`;
}

function parseHours(input: string): number | null {
  const s = input.trim().toLowerCase();
  if (!s) return null;

  let total = 0;
  let matched = false;

  // Match patterns like "2d", "2h", "2d 3h", "2d3h"
  const dayMatch = s.match(/(\d+(?:\.\d+)?)\s*d/);
  const hourMatch = s.match(/(\d+(?:\.\d+)?)\s*h/);

  if (dayMatch) { total += parseFloat(dayMatch[1]) * HOURS_PER_DAY; matched = true; }
  if (hourMatch) { total += parseFloat(hourMatch[1]); matched = true; }

  // Plain number — treat as hours
  if (!matched) {
    const n = parseFloat(s);
    if (!isNaN(n)) { total = n; matched = true; }
  }

  if (!matched || total < 1) return null;
  return Math.round(total);
}

function HoursInput({ hours, max, onChange }: { hours: number; max: number; onChange: (h: number) => void }) {
  const [draft, setDraft] = useState(() => formatHours(hours));
  const [invalid, setInvalid] = useState(false);
  const committedHours = useRef(hours);

  // Sync when external value changes (e.g. phase reorder)
  if (committedHours.current !== hours) {
    committedHours.current = hours;
    setDraft(formatHours(hours));
    setInvalid(false);
  }

  const commit = () => {
    const parsed = parseHours(draft);
    if (parsed === null) {
      setInvalid(true);
      return;
    }
    const clamped = clamp(parsed, 1, max);
    committedHours.current = clamped;
    setDraft(formatHours(clamped));
    setInvalid(false);
    if (clamped !== hours) onChange(clamped);
  };

  return (
    <input
      type="text"
      className={`w-full border rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 ${
        invalid
          ? 'border-red-400 focus:ring-red-400 bg-red-50'
          : 'border-slate-300 focus:ring-cyan-400'
      }`}
      placeholder="напр. 2d 4h"
      value={draft}
      onChange={e => { setDraft(e.target.value); setInvalid(false); }}
      onBlur={commit}
      onKeyDown={e => e.key === 'Enter' && commit()}
    />
  );
}

function dayPositionToISO(startDate: string, dayPosition: number): string {
  const safeDayIndex = Math.max(0, Math.ceil(dayPosition) - 1);
  return addDaysISO(startDate, safeDayIndex);
}

function formatHumanDate(iso: string): string {
  return parseISODateLocal(iso).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
  });
}

function formatShortDate(iso: string): string {
  return parseISODateLocal(iso).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'short',
  });
}

function formatPhaseRange(startDate: string, startDay: number, endDay: number): string {
  const from = dayPositionToISO(startDate, Math.max(1, startDay + 1));
  const to = dayPositionToISO(startDate, Math.max(1, endDay));

  if (from === to) return formatShortDate(from);
  return `${formatShortDate(from)} - ${formatShortDate(to)}`;
}

function normalizeText(value: string): string {
  return value.trim().toLowerCase();
}

function getPhaseRoleKind(label: string): PhaseRoleKind {
  const normalized = normalizeText(label);

  if (
    normalized === 'dev' ||
    normalized === 'development' ||
    normalized.includes('разраб') ||
    normalized.includes('разработ')
  ) {
    return 'dev';
  }

  if (
    normalized === 'test' ||
    normalized === 'qa' ||
    normalized.includes('тест') ||
    normalized.includes('qa')
  ) {
    return 'test';
  }

  return null;
}

function getPhaseAccent(label: string): string {
  const normalized = normalizeText(label);

  if (isReviewPhase(label)) return 'border-violet-300 bg-violet-50 text-violet-700';
  if (normalized === 'test' || normalized === 'qa' || normalized.includes('тест')) {
    return 'border-emerald-300 bg-emerald-50 text-emerald-700';
  }
  if (normalized === 'dev' || normalized.includes('разраб')) {
    return 'border-sky-300 bg-sky-50 text-sky-700';
  }

  return 'border-slate-300 bg-slate-50 text-slate-600';
}

function getPersonLabel(phase: Phase, people: Person[]): string {
  if (isReviewPhase(phase.label)) return 'Внешняя фаза';
  const person = people.find(item => item.id === phase.assigneeId);
  return person ? person.name : 'Без исполнителя';
}

function isAllowedForPhase(person: Person, phase: Phase): boolean {
  const phaseRoleKind = getPhaseRoleKind(phase.label);
  if (!phaseRoleKind) return true;

  const role = normalizeText(person.role);

  if (phaseRoleKind === 'test') {
    return (
      role.includes('тест') ||
      role.includes('qa') ||
      role.includes('tester') ||
      role.includes('test')
    );
  }

  return true;
}


function applyInitialAssignee(phases: Phase[], people: Person[], initialAssigneeId: string | null): Phase[] {
  if (!initialAssigneeId) return phases;

  const person = people.find(item => item.id === initialAssigneeId);
  if (!person) return phases;

  const phaseIndex = phases.findIndex(phase => isAllowedForPhase(person, phase));
  if (phaseIndex === -1) return phases;

  return phases.map((phase, index) =>
    index === phaseIndex ? { ...phase, assigneeId: initialAssigneeId } : phase
  );
}

export function TaskEditor({
  task,
  people,
  sprintDays,
  startDate,
  events = [],
  initialStartDay = null,
  initialAssigneeId = null,
  onSave,
  onDelete,
  onClose,
}: Props) {
  const [name, setName] = useState(task?.name ?? '');
  const [link, setLink] = useState(task?.link ?? '');
  const [sprintGoal, setSprintGoal] = useState(task?.sprintGoal ?? false);
  const sprintEndDate = addDaysISO(startDate, Math.max(sprintDays - 1, 0));
  const initialStartDate = addDaysISO(
    startDate,
    clamp(task?.startDay ?? initialStartDay ?? 0, 0, Math.max(sprintDays - 1, 0))
  );
  const [selectedStartDate, setSelectedStartDate] = useState(initialStartDate);
  const [phases, setPhases] = useState<Phase[]>(
    task?.phases.length
      ? task.phases
      : applyInitialAssignee(DEFAULT_PHASE_LABELS.map(emptyPhase), people, initialAssigneeId)
  );

  const updatePhase = (idx: number, patch: Partial<Phase>) =>
    setPhases(prev => prev.map((p, i) => i === idx ? { ...p, ...patch } : p));

  const addPhase = () =>
    setPhases(prev => [...prev, emptyPhase('Dev')]);

  const removePhase = (idx: number) =>
    setPhases(prev => prev.filter((_, i) => i !== idx));

  const movePhase = (idx: number, dir: -1 | 1) => {
    const next = [...phases];
    const s = idx + dir;
    if (s < 0 || s >= next.length) return;
    [next[idx], next[s]] = [next[s], next[idx]];
    setPhases(next);
  };

  const totalDuration = phases.reduce((s, p) => s + (p.durationDays || 0), 0);
  const startDay = clamp(diffDaysISO(startDate, selectedStartDate), 0, Math.max(sprintDays - 1, 0));
  const previewTask: Task = {
    id: task?.id ?? 'preview',
    name: name.trim() || 'preview',
    link: link.trim() || undefined,
    sprintGoal,
    startDay,
    sprintStartDate: task?.sprintStartDate ?? '',
    phases,
  };
  const phaseSchedule = computeTaskPhaseSchedule(previewTask, startDate, events);
  const completionDayPosition = phaseSchedule.reduce((max, phase) => Math.max(max, phase.endDay), startDay);
  const completionDate = dayPositionToISO(startDate, completionDayPosition);
  const overflow = completionDayPosition > sprintDays;

  const handleSave = () => {
    const n = name.trim();
    if (!n) return;
    onSave({
      id: task?.id ?? generateId(),
      name: n,
      link: link.trim() || undefined,
      sprintGoal,
      startDay,
      sprintStartDate: task?.sprintStartDate ?? '',
      phases: phases.filter(p => p.durationDays > 0),
    });
    onClose();
  };

  return (
    <Modal title={task ? 'Редактировать задачу' : 'Новая задача'} onClose={onClose} size="wide">
      <div className="flex flex-col gap-5">
        {/* Name */}
        <div className="space-y-3">
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1">Название</label>
          <input
            autoFocus
            className="w-full border border-slate-300 rounded-lg px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-cyan-400"
            placeholder="Например: PROJ-42 Авторизация"
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSave()}
          />
          <div>
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1">Ссылка</label>
            <input
              type="url"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400"
              placeholder="https://..."
              value={link}
              onChange={e => setLink(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-[1fr_auto] gap-3">
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-medium text-slate-700">
                <span>{formatShortDate(selectedStartDate)}</span>
                <span className="text-slate-300">→</span>
                <span>{formatShortDate(completionDate)}</span>
                <span className="text-slate-300">·</span>
                <span>{formatDuration(totalDuration)}</span>
              </div>
              <div className="mt-1 text-xs text-slate-400">Выходные и командные выходные пропускаются</div>
            </div>
            <label className="flex min-w-38 items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5 cursor-pointer hover:border-cyan-200">
              <span>
                <span className="block text-sm font-medium text-slate-700">Цель</span>
                <span className="block text-xs text-slate-400">для спринта</span>
              </span>
              <input
                type="checkbox"
                className="peer sr-only"
                checked={sprintGoal}
                onChange={e => setSprintGoal(e.target.checked)}
              />
              <span className={`relative h-6 w-10 rounded-full transition-colors ${sprintGoal ? 'bg-cyan-500' : 'bg-slate-200'}`}>
                <span className={`absolute left-1 top-1 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${sprintGoal ? 'translate-x-4' : ''}`} />
              </span>
            </label>
          </div>
        </div>

        {/* Start date */}
        <div>
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1">
            Дата начала <span className="font-normal text-slate-400 normal-case">(только в пределах спринта)</span>
          </label>
          <input
            type="date"
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400"
            value={selectedStartDate}
            min={startDate}
            max={sprintEndDate}
            onChange={e => setSelectedStartDate(e.target.value || initialStartDate)}
          />
          <p className="mt-1 text-xs text-slate-400">
            День {startDay + 1} спринта · {parseISODateLocal(selectedStartDate).toLocaleDateString('ru-RU', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
            })}
          </p>
        </div>

        {/* Phases */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Фазы</label>
            <button onClick={addPhase} className="rounded-md px-2 py-1 text-xs text-cyan-700 hover:bg-cyan-50 font-medium">
              + Добавить фазу
            </button>
          </div>
          <div className="relative flex flex-col gap-3 pl-6">
            <div className="absolute left-2.5 top-6 bottom-6 w-px bg-slate-200" />
            {phases.map((phase, idx) => {
              const phaseRoleKind = getPhaseRoleKind(phase.label);
              const isReview = isReviewPhase(phase.label);
              const filteredPeople = people.filter(person => isAllowedForPhase(person, phase));
              const selectedPerson = people.find(person => person.id === phase.assigneeId);
              const selectedPersonAllowed =
                !selectedPerson || filteredPeople.some(person => person.id === selectedPerson.id);
              const scheduled = phaseSchedule.find(item => item.phaseId === phase.id);
              const accent = getPhaseAccent(phase.label);

              return (
                <div key={phase.id} className="relative rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
                  <div className={`absolute -left-[1.86rem] top-4 h-5 w-5 rounded-full border-2 ${accent}`} />
                  <div className="flex items-start gap-3">
                    <div className="flex flex-col gap-1 pt-0.5">
                      <button onClick={() => movePhase(idx, -1)} disabled={idx === 0}
                        className="h-5 w-5 rounded text-slate-300 hover:bg-slate-100 hover:text-slate-500 disabled:opacity-20 text-[10px] leading-none"
                        aria-label="Поднять фазу">▲</button>
                      <button onClick={() => movePhase(idx, 1)} disabled={idx === phases.length - 1}
                        className="h-5 w-5 rounded text-slate-300 hover:bg-slate-100 hover:text-slate-500 disabled:opacity-20 text-[10px] leading-none"
                        aria-label="Опустить фазу">▼</button>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="grid grid-cols-[minmax(0,1fr)_8rem_auto] gap-2">
                        <select
                          className="min-w-0 border border-slate-300 rounded-lg bg-white px-2 py-1.5 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-cyan-400"
                          value={phase.label}
                          onChange={e => {
                            const newLabel = e.target.value;
                            updatePhase(idx, {
                              label: newLabel,
                              assigneeId: isReviewPhase(newLabel) ? '' : phase.assigneeId,
                            });
                          }}
                        >
                          <option value="Dev">Dev</option>
                          <option value="Review">Review</option>
                          <option value="Test">Test</option>
                        </select>
                        <HoursInput
                          hours={daysToHours(phase.durationDays)}
                          max={sprintDays * HOURS_PER_DAY}
                          onChange={h => updatePhase(idx, { durationDays: hoursToDays(h) })}
                        />
                        <button onClick={() => removePhase(idx)}
                          className="h-8 w-8 rounded-lg text-red-300 hover:bg-red-50 hover:text-red-500 font-bold text-lg leading-none"
                          aria-label="Удалить фазу">×</button>
                      </div>
                      <div className="mt-2 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3">
                        <div>
                          <label className="text-[10px] text-slate-400 block mb-1">Исполнитель</label>
                          {isReview ? (
                            <div className="w-full border border-violet-100 rounded-lg bg-violet-50 px-2 py-1.5 text-xs text-violet-700">
                              <span className="font-medium">Внешние ревьюеры</span>
                              <span className="ml-1 text-violet-400">без нагрузки</span>
                            </div>
                          ) : (
                            <>
                              <select
                                className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-cyan-400"
                                value={phase.assigneeId}
                                onChange={e => updatePhase(idx, { assigneeId: e.target.value })}
                              >
                                <option value="">— без исполнителя —</option>
                                {!selectedPersonAllowed && selectedPerson && (
                                  <option value={selectedPerson.id}>
                                    {selectedPerson.name} ({selectedPerson.role}) — недоступно для этой фазы
                                  </option>
                                )}
                                {filteredPeople.map(p => (
                                  <option key={p.id} value={p.id}>{p.name} ({p.role})</option>
                                ))}
                              </select>
                              {phaseRoleKind === 'test' && (
                                <div className="mt-1 text-[10px] text-slate-400">Для фазы Test доступны только тестировщики.</div>
                              )}
                            </>
                          )}
                        </div>
                        <div className="max-w-42 text-right text-xs text-slate-400">
                          <div>{scheduled ? formatPhaseRange(startDate, scheduled.startDay, scheduled.endDay) : 'без даты'}</div>
                          <div className="mt-0.5 font-medium text-slate-500">{getPersonLabel(phase, people)}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Actions */}
        <div className="sticky -bottom-4 z-10 -mx-6 flex items-center gap-3 border-t border-slate-200 bg-white/95 px-6 py-4 backdrop-blur">
          <div className={`mr-auto text-xs ${overflow ? 'text-red-700' : 'text-slate-500'}`}>
            <span className="font-medium text-slate-700">Итого: {daysToHours(totalDuration)}ч</span>
            <span> · {formatDuration(totalDuration)} · до {formatHumanDate(completionDate)}</span>
            {overflow && <span> · выходит за пределы спринта ({sprintDays * HOURS_PER_DAY}ч)</span>}
          </div>
          {task && onDelete && (
            <button onClick={() => { onDelete(task.id); onClose(); }}
              className="text-xs text-red-400 hover:text-red-600">
              Удалить задачу
            </button>
          )}
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-500 hover:text-slate-700">
            Отмена
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 text-sm bg-cyan-500 text-white rounded-lg hover:bg-cyan-600 font-medium transition-colors"
          >
            Сохранить
          </button>
        </div>
      </div>
    </Modal>
  );
}
