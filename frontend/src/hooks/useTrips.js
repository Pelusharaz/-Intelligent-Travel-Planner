import { useState, useCallback, useEffect } from 'react';
import * as tripsApi from '../api/trips';

export function useTrips() {
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await tripsApi.listTrips();
      setTrips(data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load trips');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { trips, loading, error, refresh };
}

export function useTrip(tripId) {
  const [trip, setTrip] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    if (!tripId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await tripsApi.getTrip(tripId);
      setTrip(data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load trip');
    } finally {
      setLoading(false);
    }
  }, [tripId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { trip, loading, error, refresh };
}
