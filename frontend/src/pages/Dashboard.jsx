import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import { useTrips } from '../hooks/useTrips';

const STATUS_STYLES = {
  draft: 'bg-slate-100 text-slate-600',
  generated: 'bg-emerald-100 text-emerald-700',
  confirmed: 'bg-brand-100 text-brand-700',
};

function formatDateRange(start, end) {
  const opts = { month: 'short', day: 'numeric' };
  return `${new Date(start).toLocaleDateString(undefined, opts)} – ${new Date(end).toLocaleDateString(
    undefined,
    opts
  )}`;
}

export default function Dashboard() {
  const { trips, loading, error } = useTrips();

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <main className="mx-auto max-w-6xl px-4 py-10">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Your trips</h1>
            <p className="text-sm text-slate-500">Plan, view, and refine your itineraries.</p>
          </div>
          <Link
            to="/trips/new"
            className="rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
          >
            + New trip
          </Link>
        </div>

        {loading && <p className="text-sm text-slate-400">Loading trips…</p>}
        {error && <p className="text-sm text-red-600">{error}</p>}

        {!loading && trips.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
            <p className="text-slate-500">No trips yet — create your first one to get started.</p>
            <Link
              to="/trips/new"
              className="mt-4 inline-block rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
            >
              Plan a trip
            </Link>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {trips.map((trip) => (
            <Link
              key={trip.id}
              to={`/trips/${trip.id}`}
              className="block rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md"
            >
              <div className="mb-2 flex items-start justify-between">
                <h2 className="text-lg font-semibold text-slate-800">{trip.destination_name}</h2>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
                    STATUS_STYLES[trip.status] || STATUS_STYLES.draft
                  }`}
                >
                  {trip.status}
                </span>
              </div>
              <p className="text-sm text-slate-500">
                {formatDateRange(trip.start_date, trip.end_date)}
              </p>
              {trip.budget_total && (
                <p className="mt-2 text-sm font-medium text-slate-600">
                  Budget: {Number(trip.budget_total).toLocaleString()} {trip.budget_currency}
                </p>
              )}
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}
