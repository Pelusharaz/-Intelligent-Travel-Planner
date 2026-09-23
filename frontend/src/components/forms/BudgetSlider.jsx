const CURRENCIES = ['USD', 'EUR', 'GBP', 'KES', 'JPY'];

export default function BudgetSlider({ value, currency, onChange, onCurrencyChange }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-slate-700">Total trip budget</label>
        <div className="flex items-center gap-2">
          <span className="text-lg font-semibold text-brand-700">
            {Number(value).toLocaleString()}
          </span>
          <select
            className="rounded-md border border-slate-300 bg-white px-2 py-1 text-sm"
            value={currency}
            onChange={(e) => onCurrencyChange(e.target.value)}
          >
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>
      <input
        type="range"
        min={100}
        max={10000}
        step={50}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-blue-600"
      />
      <div className="flex justify-between text-xs text-slate-400">
        <span>100</span>
        <span>10,000</span>
      </div>
    </div>
  );
}
