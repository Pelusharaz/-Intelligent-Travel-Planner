export default function DateRangePicker({ startDate, endDate, onChange }) {
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="grid grid-cols-2 gap-4">
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Start date</label>
        <input
          type="date"
          min={today}
          value={startDate}
          onChange={(e) => onChange({ startDate: e.target.value, endDate })}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
          required
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">End date</label>
        <input
          type="date"
          min={startDate || today}
          value={endDate}
          onChange={(e) => onChange({ startDate, endDate: e.target.value })}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
          required
        />
      </div>
    </div>
  );
}
