const CATEGORY_EMOJI = {
  museums: '🏛️',
  nature: '🌳',
  nightlife: '🌃',
  food: '🍜',
  history: '🏺',
  shopping: '🛍️',
  adventure: '🧗',
  relaxation: '🧘',
  art: '🎨',
  family: '👨‍👩‍👧',
};

function formatTime(timeStr) {
  if (!timeStr) return '';
  const [h, m] = timeStr.split(':');
  const hour = parseInt(h, 10);
  const suffix = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${hour12}:${m} ${suffix}`;
}

export default function StopCard({ stop, index, dayColor, draggable, onDragStart, onDragOver, onDrop }) {
  const poi = stop.poi || {};
  return (
    <div
      draggable={draggable}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      className="group flex items-start gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm transition hover:shadow-md"
    >
      <div
        className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
        style={{ backgroundColor: dayColor }}
      >
        {index + 1}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <h4 className="truncate text-sm font-semibold text-slate-800">
            {CATEGORY_EMOJI[poi.category] || '📍'} {poi.name}
          </h4>
          {draggable && (
            <span className="cursor-grab select-none text-slate-300 group-hover:text-slate-400">
              ⠿
            </span>
          )}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
          <span>🕒 {formatTime(stop.estimated_arrival)}</span>
          <span>⏱ {stop.estimated_duration_minutes} min</span>
          {stop.travel_minutes_from_prev > 0 && (
            <span>🚶 {stop.travel_minutes_from_prev} min travel</span>
          )}
          {poi.rating && <span>⭐ {poi.rating}</span>}
          {poi.price_level != null && <span>{'$'.repeat(Math.max(1, poi.price_level))}</span>}
        </div>
      </div>
    </div>
  );
}
