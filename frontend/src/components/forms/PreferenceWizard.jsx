import { useState } from 'react';
import BudgetSlider from './BudgetSlider';
import DateRangePicker from './DateRangePicker';

const INTEREST_TAGS = [
  { key: 'museums', label: 'Museums', emoji: '🏛️' },
  { key: 'nature', label: 'Nature', emoji: '🌳' },
  { key: 'nightlife', label: 'Nightlife', emoji: '🌃' },
  { key: 'food', label: 'Food', emoji: '🍜' },
  { key: 'history', label: 'History', emoji: '🏺' },
  { key: 'shopping', label: 'Shopping', emoji: '🛍️' },
  { key: 'adventure', label: 'Adventure', emoji: '🧗' },
  { key: 'relaxation', label: 'Relaxation', emoji: '🧘' },
  { key: 'art', label: 'Art & Design', emoji: '🎨' },
  { key: 'family', label: 'Family', emoji: '👨‍👩‍👧' },
];

const STEPS = ['Destination', 'Dates', 'Budget', 'Interests'];

export default function PreferenceWizard({ onSubmit, submitting }) {
  const [step, setStep] = useState(0);
  const [destination, setDestination] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [budget, setBudget] = useState(1500);
  const [currency, setCurrency] = useState('USD');
  const [selectedTags, setSelectedTags] = useState({}); // { tag: weight }

  const toggleTag = (tag) => {
    setSelectedTags((prev) => {
      const next = { ...prev };
      if (tag in next) delete next[tag];
      else next[tag] = 5;
      return next;
    });
  };

  const setWeight = (tag, weight) => {
    setSelectedTags((prev) => ({ ...prev, [tag]: weight }));
  };

  const canAdvance = () => {
    if (step === 0) return destination.trim().length > 0;
    if (step === 1) return startDate && endDate && startDate <= endDate;
    if (step === 2) return true;
    return true;
  };

  const handleSubmit = () => {
    const preferences = Object.entries(selectedTags).map(([interest_tag, weight]) => ({
      interest_tag,
      weight,
    }));
    onSubmit({
      destination_name: destination.trim(),
      start_date: startDate,
      end_date: endDate,
      budget_total: budget,
      budget_currency: currency,
      preferences,
    });
  };

  return (
    <div className="mx-auto w-full max-w-xl rounded-2xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
      {/* Step indicator */}
      <div className="mb-8 flex items-center gap-2">
        {STEPS.map((label, idx) => (
          <div key={label} className="flex flex-1 items-center gap-2">
            <div
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                idx <= step ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-400'
              }`}
            >
              {idx + 1}
            </div>
            {idx < STEPS.length - 1 && (
              <div className={`h-0.5 flex-1 ${idx < step ? 'bg-brand-600' : 'bg-slate-100'}`} />
            )}
          </div>
        ))}
      </div>
      <p className="mb-6 text-sm font-medium uppercase tracking-wide text-brand-600">
        {STEPS[step]}
      </p>

      {step === 0 && (
        <div className="space-y-2">
          <label className="block text-sm font-medium text-slate-700">
            Where do you want to go?
          </label>
          <input
            type="text"
            autoFocus
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            placeholder="e.g. Paris, France"
            className="w-full rounded-md border border-slate-300 px-3 py-2.5 text-sm focus:border-brand-500 focus:outline-none"
          />
          <p className="text-xs text-slate-400">
            We&apos;ll geocode this and search for points of interest nearby.
          </p>
        </div>
      )}

      {step === 1 && (
        <DateRangePicker
          startDate={startDate}
          endDate={endDate}
          onChange={({ startDate: s, endDate: e }) => {
            setStartDate(s);
            setEndDate(e);
          }}
        />
      )}

      {step === 2 && (
        <BudgetSlider
          value={budget}
          currency={currency}
          onChange={setBudget}
          onCurrencyChange={setCurrency}
        />
      )}

      {step === 3 && (
        <div className="space-y-4">
          <p className="text-sm text-slate-500">
            Pick your interests, then adjust how strongly each should be weighted (1-10).
          </p>
          <div className="grid grid-cols-2 gap-2">
            {INTEREST_TAGS.map((tag) => {
              const active = tag.key in selectedTags;
              return (
                <button
                  key={tag.key}
                  type="button"
                  onClick={() => toggleTag(tag.key)}
                  className={`rounded-lg border px-3 py-2 text-left text-sm transition ${
                    active
                      ? 'border-brand-500 bg-brand-50 text-brand-800'
                      : 'border-slate-200 text-slate-600 hover:border-slate-300'
                  }`}
                >
                  <span className="mr-2">{tag.emoji}</span>
                  {tag.label}
                </button>
              );
            })}
          </div>

          {Object.keys(selectedTags).length > 0 && (
            <div className="space-y-3 rounded-lg bg-slate-50 p-4">
              {Object.entries(selectedTags).map(([tag, weight]) => (
                <div key={tag} className="flex items-center gap-3">
                  <span className="w-24 shrink-0 text-xs font-medium capitalize text-slate-600">
                    {tag}
                  </span>
                  <input
                    type="range"
                    min={1}
                    max={10}
                    value={weight}
                    onChange={(e) => setWeight(tag, Number(e.target.value))}
                    className="flex-1 accent-blue-600"
                  />
                  <span className="w-6 text-right text-xs font-semibold text-slate-500">
                    {weight}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="mt-8 flex justify-between">
        <button
          type="button"
          disabled={step === 0}
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          className="rounded-md px-4 py-2 text-sm font-medium text-slate-500 disabled:opacity-0"
        >
          Back
        </button>
        {step < STEPS.length - 1 ? (
          <button
            type="button"
            disabled={!canAdvance()}
            onClick={() => setStep((s) => Math.min(STEPS.length - 1, s + 1))}
            className="rounded-md bg-brand-600 px-5 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            Next
          </button>
        ) : (
          <button
            type="button"
            disabled={Object.keys(selectedTags).length === 0 || submitting}
            onClick={handleSubmit}
            className="rounded-md bg-brand-600 px-5 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {submitting ? 'Creating trip…' : 'Create trip & generate itinerary'}
          </button>
        )}
      </div>
    </div>
  );
}
