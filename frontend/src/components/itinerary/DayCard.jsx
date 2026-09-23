import { useState } from 'react';
import StopCard from './StopCard';

const DAY_COLORS = ['#2563eb', '#059669', '#d97706', '#dc2626', '#7c3aed', '#0891b2', '#db2777'];

function formatDate(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
}

export default function DayCard({ day, onReorder }) {
  const color = DAY_COLORS[(day.day_number - 1) % DAY_COLORS.length];
  const [dragIndex, setDragIndex] = useState(null);

  const stops = [...day.stops].sort((a, b) => a.sequence_order - b.sequence_order);

  const handleDrop = (targetIndex) => {
    if (dragIndex === null || dragIndex === targetIndex) return;
    const stop = stops[dragIndex];
    // sequence_order is 1-indexed
    onReorder(stop.id, targetIndex + 1);
    setDragIndex(null);
  };

  const badWeather = day.precip_probability > 0.5;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: color }}
            />
            <h3 className="text-sm font-bold uppercase tracking-wide text-slate-500">
              Day {day.day_number}
            </h3>
          </div>
          <p className="text-lg font-semibold text-slate-800">{formatDate(day.date)}</p>
        </div>
        <div className="text-right text-sm text-slate-500">
          <p>
            {day.weather_summary} · {day.weather_temp_c}°C
          </p>
          {badWeather && (
            <p className="text-xs font-medium text-amber-600">
              ☔ {Math.round(day.precip_probability * 100)}% rain — indoor stops prioritised
            </p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        {stops.map((stop, idx) => (
          <StopCard
            key={stop.id}
            stop={stop}
            index={idx}
            dayColor={color}
            draggable
            onDragStart={() => setDragIndex(idx)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => handleDrop(idx)}
          />
        ))}
        {stops.length === 0 && (
          <p className="py-4 text-center text-sm text-slate-400">No stops scheduled.</p>
        )}
      </div>
    </div>
  );
}

export { DAY_COLORS };
