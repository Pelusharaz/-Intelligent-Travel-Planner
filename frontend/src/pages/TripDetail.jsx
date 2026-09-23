import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import DayCard from '../components/itinerary/DayCard';
import ItineraryMap from '../components/map/ItineraryMap';
import { useTrip } from '../hooks/useTrips';
import * as tripsApi from '../api/trips';
import * as itinerariesApi from '../api/itineraries';

export default function TripDetail() {
  const { id } = useParams();
  const { trip, loading: tripLoading, error: tripError } = useTrip(id);

  const [itinerary, setItinerary] = useState(null);
  const [itineraryLoading, setItineraryLoading] = useState(true);
  const [itineraryError, setItineraryError] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [activeDay, setActiveDay] = useState(1);
  const [view, setView] = useState('list'); // 'list' | 'map'

  const loadItinerary = useCallback(async () => {
    setItineraryLoading(true);
    setItineraryError(null);
    try {
      const data = await tripsApi.getTripItinerary(id);
      setItinerary(data);
    } catch (err) {
      if (err.response?.status === 404) {
        setItinerary(null); // not generated yet - not a hard error
      } else {
        setItineraryError(err.response?.data?.error || 'Failed to load itinerary');
      }
    } finally {
      setItineraryLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadItinerary();
  }, [loadItinerary]);

  const handleGenerate = async () => {
    setGenerating(true);
    setItineraryError(null);
    try {
      const data = await tripsApi.generateItinerary(id);
      setItinerary(data);
      setActiveDay(1);
    } catch (err) {
      setItineraryError(err.response?.data?.error || 'Failed to generate itinerary');
    } finally {
      setGenerating(false);
    }
  };

  const handleReorder = async (stopId, sequenceOrder) => {
    if (!itinerary) return;
    await itinerariesApi.reorderStop(itinerary.id, stopId, sequenceOrder);
    await loadItinerary();
  };

  if (tripLoading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Navbar />
        <p className="p-10 text-sm text-slate-400">Loading trip…</p>
      </div>
    );
  }

  if (tripError || !trip) {
    return (
      <div className="min-h-screen bg-slate-50">
        <Navbar />
        <div className="p-10">
          <p className="text-sm text-red-600">{tripError || 'Trip not found'}</p>
          <Link to="/dashboard" className="mt-2 inline-block text-sm text-brand-600 hover:underline">
            ← Back to dashboard
          </Link>
        </div>
      </div>
    );
  }

  const currentDay = itinerary?.days.find((d) => d.day_number === activeDay);

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <main className="mx-auto max-w-6xl px-4 py-10">
        <Link to="/dashboard" className="text-sm text-brand-600 hover:underline">
          ← Back to dashboard
        </Link>

        <div className="mt-3 mb-8 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">{trip.destination_name}</h1>
            <p className="text-sm text-slate-500">
              {new Date(trip.start_date).toLocaleDateString()} –{' '}
              {new Date(trip.end_date).toLocaleDateString()}
              {trip.budget_total &&
                ` · Budget ${Number(trip.budget_total).toLocaleString()} ${trip.budget_currency}`}
            </p>
            {trip.preferences?.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {trip.preferences.map((p) => (
                  <span
                    key={p.id}
                    className="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-medium capitalize text-brand-700"
                  >
                    {p.interest_tag} · {p.weight}
                  </span>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={handleGenerate}
            disabled={generating}
            className="rounded-md bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:bg-slate-300"
          >
            {generating ? 'Generating…' : itinerary ? 'Regenerate itinerary' : 'Generate itinerary'}
          </button>
        </div>

        {itineraryError && (
          <div className="mb-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">
            {itineraryError}
          </div>
        )}

        {itineraryLoading && <p className="text-sm text-slate-400">Loading itinerary…</p>}

        {!itineraryLoading && !itinerary && !itineraryError && (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center">
            <p className="text-slate-500">
              No itinerary generated yet. Click &ldquo;Generate itinerary&rdquo; above to build one.
            </p>
          </div>
        )}

        {itinerary && (
          <>
            {/* Day tabs + view toggle */}
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-2">
                {itinerary.days.map((d) => (
                  <button
                    key={d.id}
                    onClick={() => setActiveDay(d.day_number)}
                    className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
                      activeDay === d.day_number
                        ? 'bg-brand-600 text-white'
                        : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    Day {d.day_number}
                  </button>
                ))}
              </div>
              <div className="flex rounded-md bg-white p-1 ring-1 ring-slate-200">
                {['list', 'map'].map((v) => (
                  <button
                    key={v}
                    onClick={() => setView(v)}
                    className={`rounded px-3 py-1 text-xs font-semibold capitalize ${
                      view === v ? 'bg-brand-600 text-white' : 'text-slate-500'
                    }`}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>

            {view === 'list' && currentDay && (
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <DayCard day={currentDay} onReorder={handleReorder} />
                <ItineraryMap destination={itinerary.destination} days={[currentDay]} />
              </div>
            )}

            {view === 'map' && (
              <ItineraryMap destination={itinerary.destination} days={itinerary.days} height="650px" />
            )}
          </>
        )}
      </main>
    </div>
  );
}
