import { useState } from 'react';
import type { Person, Team } from '../types';
import { Modal } from './Modal';

interface Props {
  teams: Team[];
  people: Person[];
  onAddTeam: (name: string) => void;
  onUpdateTeam: (team: Team) => void;
  onDeleteTeam: (id: string) => void;
  onAddPerson: (name: string, role: string, teamId: string) => void;
  onUpdatePerson: (person: Person) => void;
  onDeletePerson: (id: string) => void;
  onClose: () => void;
}

const PRESET_ROLES = ['Разработчик', 'Ревьюер', 'Тестировщик', 'Дизайнер', 'Аналитик'];

export function TeamManager({
  teams, people,
  onAddTeam, onUpdateTeam, onDeleteTeam,
  onAddPerson, onUpdatePerson, onDeletePerson,
  onClose,
}: Props) {
  const [tab, setTab] = useState<'people' | 'teams'>('people');

  // People form
  const [pName, setPName] = useState('');
  const [pRole, setPRole] = useState(PRESET_ROLES[0]);
  const [pRoleCustom, setPRoleCustom] = useState('');
  const [pTeam, setPTeam] = useState(teams[0]?.id ?? '');
  const [editingPerson, setEditingPerson] = useState<Person | null>(null);

  // Teams form
  const [tName, setTName] = useState('');
  const [editingTeam, setEditingTeam] = useState<Team | null>(null);

  const effectiveRole = pRole === '__custom__' ? pRoleCustom.trim() : pRole;

  const handleAddPerson = () => {
    const n = pName.trim();
    if (!n || !effectiveRole) return;
    onAddPerson(n, effectiveRole, pTeam || teams[0]?.id);
    setPName('');
  };

  const handleSavePerson = () => {
    if (!editingPerson) return;
    onUpdatePerson(editingPerson);
    setEditingPerson(null);
  };

  const handleAddTeam = () => {
    const n = tName.trim();
    if (!n) return;
    onAddTeam(n);
    setTName('');
  };

  return (
    <Modal title="Команда" onClose={onClose}>
      {/* Tabs */}
      <div className="flex gap-1 mb-4 bg-slate-100 rounded-lg p-1">
        {(['people', 'teams'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 text-xs font-medium py-1.5 rounded-md transition-colors ${
              tab === t ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {t === 'people' ? `Участники (${people.length})` : `Команды (${teams.length})`}
          </button>
        ))}
      </div>

      {tab === 'people' && (
        <div className="flex flex-col gap-4">
          {/* Add person */}
          <div className="bg-slate-50 rounded-xl p-3 flex flex-col gap-2">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Добавить участника</div>
            <input
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400"
              placeholder="Имя"
              value={pName}
              onChange={e => setPName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddPerson()}
            />
            <div className="grid grid-cols-2 gap-2">
              <select
                className="border border-slate-300 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400"
                value={pRole}
                onChange={e => setPRole(e.target.value)}
              >
                {PRESET_ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                <option value="__custom__">Своя роль...</option>
              </select>
              <select
                className="border border-slate-300 rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400"
                value={pTeam}
                onChange={e => setPTeam(e.target.value)}
              >
                {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            {pRole === '__custom__' && (
              <input
                className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400"
                placeholder="Название роли"
                value={pRoleCustom}
                onChange={e => setPRoleCustom(e.target.value)}
              />
            )}
            <button
              onClick={handleAddPerson}
              className="bg-cyan-500 text-white rounded-lg py-2 text-sm font-medium hover:bg-cyan-600 transition-colors"
            >
              Добавить
            </button>
          </div>

          {/* People list */}
          <div className="flex flex-col gap-1.5 max-h-72 overflow-y-auto">
            {people.map(person => {
              const team = teams.find(t => t.id === person.teamId);
              return (
                <div key={person.id} className="flex items-center gap-2 p-2 rounded-lg bg-white border border-slate-200">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                    style={{ background: person.color }}>
                    {person.name.charAt(0)}
                  </div>
                  {editingPerson?.id === person.id ? (
                    <>
                      <input
                        className="flex-1 border border-slate-300 rounded px-2 py-1 text-xs min-w-0"
                        value={editingPerson.name}
                        onChange={e => setEditingPerson({ ...editingPerson, name: e.target.value })}
                      />
                      <input
                        className="w-24 border border-slate-300 rounded px-2 py-1 text-xs"
                        value={editingPerson.role}
                        onChange={e => setEditingPerson({ ...editingPerson, role: e.target.value })}
                      />
                      <select
                        className="w-24 border border-slate-300 rounded px-1 py-1 text-xs"
                        value={editingPerson.teamId}
                        onChange={e => setEditingPerson({ ...editingPerson, teamId: e.target.value })}
                      >
                        {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                      </select>
                      <button onClick={handleSavePerson} className="text-cyan-600 text-xs font-medium">✓</button>
                      <button onClick={() => setEditingPerson(null)} className="text-slate-400 text-xs">✕</button>
                    </>
                  ) : (
                    <>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-semibold text-slate-800 truncate">{person.name}</div>
                        <div className="text-[10px] text-slate-400">{person.role} · {team?.name ?? '—'}</div>
                      </div>
                      <button onClick={() => setEditingPerson({ ...person })} className="text-slate-400 hover:text-cyan-500 text-xs">✎</button>
                      <button onClick={() => onDeletePerson(person.id)} className="text-slate-300 hover:text-red-400 text-xs">×</button>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {tab === 'teams' && (
        <div className="flex flex-col gap-4">
          {/* Add team */}
          <div className="bg-slate-50 rounded-xl p-3 flex flex-col gap-2">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Добавить команду</div>
            <input
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400"
              placeholder="Название команды"
              value={tName}
              onChange={e => setTName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddTeam()}
            />
            <button
              onClick={handleAddTeam}
              className="bg-cyan-500 text-white rounded-lg py-2 text-sm font-medium hover:bg-cyan-600 transition-colors"
            >
              Создать
            </button>
          </div>

          {/* Teams list */}
          <div className="flex flex-col gap-1.5">
            {teams.map(team => (
              <div key={team.id} className="flex items-center gap-2 p-2 rounded-lg bg-white border border-slate-200">
                {editingTeam?.id === team.id ? (
                  <>
                    <input
                      className="flex-1 border border-slate-300 rounded px-2 py-1 text-xs"
                      value={editingTeam.name}
                      onChange={e => setEditingTeam({ ...editingTeam, name: e.target.value })}
                    />
                    <button onClick={() => { onUpdateTeam(editingTeam); setEditingTeam(null); }} className="text-cyan-600 text-xs font-medium">✓</button>
                    <button onClick={() => setEditingTeam(null)} className="text-slate-400 text-xs">✕</button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 text-xs font-semibold text-slate-800">{team.name}</span>
                    <span className="text-[10px] text-slate-400">
                      {people.filter(p => p.teamId === team.id).length} чел.
                    </span>
                    <button onClick={() => setEditingTeam({ ...team })} className="text-slate-400 hover:text-cyan-500 text-xs">✎</button>
                    <button onClick={() => onDeleteTeam(team.id)} className="text-slate-300 hover:text-red-400 text-xs">×</button>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </Modal>
  );
}
