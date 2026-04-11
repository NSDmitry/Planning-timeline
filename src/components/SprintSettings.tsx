import { useState } from 'react';
import type { Sprint } from '../types';
import { Modal } from './Modal';

interface Props {
  sprint: Sprint;
  onSave: (sprint: Sprint) => void;
  onClose: () => void;
}

function toMonday(iso: string): string {
  const date = new Date(iso);
  const dow = date.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  const diff = dow === 0 ? -6 : 1 - dow; // days to subtract to get to Monday
  date.setDate(date.getDate() + diff);
  return date.toISOString().slice(0, 10);
}

export function SprintSettings({ sprint, onSave, onClose }: Props) {
  const [name, setName] = useState(sprint.name);
  const [days, setDays] = useState(sprint.totalDays);
  const [startDate, setStartDate] = useState(sprint.startDate);

  const handleDateChange = (value: string) => {
    if (!value) return;
    setStartDate(toMonday(value));
  };

  const handleSave = () => {
    if (!name.trim() || days < 1 || !startDate) return;
    onSave({ name: name.trim(), totalDays: days, startDate });
    onClose();
  };

  return (
    <Modal title="Настройки спринта" onClose={onClose}>
      <div className="flex flex-col gap-4">
        <div>
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1">Название спринта</label>
          <input
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            value={name}
            onChange={e => setName(e.target.value)}
          />
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1">
            Дата начала <span className="text-slate-400 font-normal normal-case">(автоматически сдвигается к понедельнику)</span>
          </label>
          <input
            type="date"
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            value={startDate}
            onChange={e => handleDateChange(e.target.value)}
          />
          {startDate && (
            <p className="text-xs text-slate-400 mt-1">
              Начало: {new Date(startDate).toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })}
            </p>
          )}
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1">Длительность (календарных дней)</label>
          <input
            type="number"
            min={1}
            max={90}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            value={days}
            onChange={e => setDays(Math.max(1, Number(e.target.value)))}
          />
        </div>
        <div className="flex gap-2 justify-end pt-2 border-t border-slate-200">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800">Отмена</button>
          <button
            onClick={handleSave}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
          >
            Сохранить
          </button>
        </div>
      </div>
    </Modal>
  );
}
