import { useState } from 'react';
import type { Task, Phase, Person } from '../types';
import { Modal } from './Modal';
import { generateId } from '../store';
import { daysToHours, hoursToDays, formatDuration, HOURS_PER_DAY } from '../conflicts';

interface Props {
  task: Task | null;
  people: Person[];
  sprintDays: number;
  onSave: (task: Task) => void;
  onDelete?: (id: string) => void;
  onClose: () => void;
}

const DEFAULT_PHASE_LABELS = ['Dev', 'Review', 'Test'];

function emptyPhase(label: string): Phase {
  return { id: generateId(), label, assigneeId: '', durationDays: 1 };
}

export function TaskEditor({ task, people, sprintDays, onSave, onDelete, onClose }: Props) {
  const [name, setName] = useState(task?.name ?? '');
  const [startDay, setStartDay] = useState(task?.startDay ?? 0);
  const [phases, setPhases] = useState<Phase[]>(
    task?.phases.length ? task.phases : DEFAULT_PHASE_LABELS.map(emptyPhase)
  );

  const updatePhase = (idx: number, patch: Partial<Phase>) =>
    setPhases(prev => prev.map((p, i) => i === idx ? { ...p, ...patch } : p));

  const addPhase = () =>
    setPhases(prev => [...prev, emptyPhase(`Фаза ${prev.length + 1}`)]);

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
  const overflow = startDay + totalDuration > sprintDays;

  const handleSave = () => {
    const n = name.trim();
    if (!n) return;
    onSave({
      id: task?.id ?? generateId(),
      name: n,
      startDay,
      phases: phases.filter(p => p.durationDays > 0),
    });
    onClose();
  };

  return (
    <Modal title={task ? 'Редактировать задачу' : 'Новая задача'} onClose={onClose}>
      <div className="flex flex-col gap-4">
        {/* Name */}
        <div>
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1">Название</label>
          <input
            autoFocus
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400"
            placeholder="Например: PROJ-42 Авторизация"
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSave()}
          />
        </div>

        {/* Start day */}
        <div>
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1">
            День начала <span className="font-normal text-slate-400 normal-case">(от начала спринта)</span>
          </label>
          <input
            type="number" min={1} max={sprintDays}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400"
            value={startDay + 1}
            onChange={e => setStartDay(Math.max(0, Number(e.target.value) - 1))}
          />
        </div>

        {/* Phases */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Фазы</label>
            <button onClick={addPhase} className="text-xs text-cyan-600 hover:text-cyan-800 font-medium">
              + Добавить фазу
            </button>
          </div>
          <div className="flex flex-col gap-2">
            {phases.map((phase, idx) => (
              <div key={phase.id} className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                <div className="flex items-center gap-2 mb-2">
                  <div className="flex flex-col gap-0.5">
                    <button onClick={() => movePhase(idx, -1)} disabled={idx === 0}
                      className="text-slate-300 hover:text-slate-500 disabled:opacity-20 text-[10px] leading-none">▲</button>
                    <button onClick={() => movePhase(idx, 1)} disabled={idx === phases.length - 1}
                      className="text-slate-300 hover:text-slate-500 disabled:opacity-20 text-[10px] leading-none">▼</button>
                  </div>
                  <input
                    className="flex-1 border border-slate-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400"
                    value={phase.label}
                    onChange={e => updatePhase(idx, { label: e.target.value })}
                  />
                  <button onClick={() => removePhase(idx)} className="text-red-300 hover:text-red-500 font-bold text-lg leading-none">×</button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">
                      Исполнитель
                      {!phase.assigneeId && (
                        <span className="ml-1 text-slate-300">(внешний)</span>
                      )}
                    </label>
                    <select
                      className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-cyan-400"
                      value={phase.assigneeId}
                      onChange={e => updatePhase(idx, { assigneeId: e.target.value })}
                    >
                      <option value="">— внешний / без исполнителя —</option>
                      {people.map(p => (
                        <option key={p.id} value={p.id}>{p.name} ({p.role})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 block mb-1">
                      Часов
                      <span className="ml-1 text-slate-300">= {formatDuration(phase.durationDays)}</span>
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={sprintDays * HOURS_PER_DAY}
                      step={1}
                      className="w-full border border-slate-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-cyan-400"
                      value={daysToHours(phase.durationDays)}
                      onChange={e => updatePhase(idx, {
                        durationDays: hoursToDays(Math.max(1, Math.round(Number(e.target.value))))
                      })}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Summary */}
        <div className={`text-xs rounded-xl px-3 py-2.5 ${overflow ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-slate-100 text-slate-600'}`}>
          {overflow ? '⚠ ' : 'ℹ '}
          Итого: {daysToHours(totalDuration)}ч ({formatDuration(totalDuration)}) · выходные пропускаются
          {overflow && ` · выходит за пределы спринта (${sprintDays * HOURS_PER_DAY}ч)`}
        </div>

        {/* Actions */}
        <div className="flex gap-2 justify-end pt-2 border-t border-slate-200">
          {task && onDelete && (
            <button onClick={() => { onDelete(task.id); onClose(); }}
              className="mr-auto text-xs text-red-400 hover:text-red-600">
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
