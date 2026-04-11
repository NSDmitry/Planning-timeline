import type { DayLoad } from '../types';

interface Props {
  loads: DayLoad[];
  dayWidth: number;
  startDate: string;
}

function isWeekend(startDate: string, i: number) {
  const d = new Date(startDate);
  d.setDate(d.getDate() + i);
  const dow = d.getDay();
  return dow === 0 || dow === 6;
}

const LOAD_COLOR: Record<DayLoad, string> = {
  0: 'transparent',
  1: '#22c55e',
  2: '#ef4444',
};

export function WorkloadBar({ loads, dayWidth, startDate }: Props) {
  return (
    <div className="flex" style={{ height: 5 }}>
      {loads.map((load, i) => {
        const weekend = isWeekend(startDate, i);
        return (
          <div
            key={i}
            style={{
              width: dayWidth,
              height: 5,
              flexShrink: 0,
              background: weekend ? 'transparent' : LOAD_COLOR[load],
              opacity: weekend ? 0 : 1,
            }}
          />
        );
      })}
    </div>
  );
}
