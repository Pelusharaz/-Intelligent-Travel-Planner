import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import PreferenceWizard from '../components/forms/PreferenceWizard';
import * as tripsApi from '../api/trips';

export default function TripCreate() {
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (payload) => {
    setSubmitting(true);
    setError(null);
    try {
      const trip = await tripsApi.createTrip(payload);
      // Immediately trigger itinerary generation, then land on the trip view.
      await tripsApi.generateItinerary(trip.id);
      navigate(`/trips/${trip.id}`);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create trip');
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <main className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="mb-1 text-2xl font-bold text-slate-800">Plan a new trip</h1>
        <p className="mb-8 text-sm text-slate-500">
          Tell us where, when, and what you love — we&apos;ll generate a day-by-day itinerary.
        </p>
        {error && (
          <div className="mb-4 rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}
        <PreferenceWizard onSubmit={handleSubmit} submitting={submitting} />
      </main>
    </div>
  );
}
