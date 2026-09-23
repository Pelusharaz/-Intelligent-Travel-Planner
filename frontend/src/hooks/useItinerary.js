import { useState, useCallback, useEffect } from 'react';
import * as itinerariesApi from '../api/itineraries';

export function useItinerary(itineraryId) {
  const [itinerary, setItinerary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    if (!itineraryId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await itinerariesApi.getItinerary(itineraryId);
      setItinerary(data);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load itinerary');
    } finally {
      setLoading(false);
    }
  }, [itineraryId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const reorderStop = useCallback(
    async (stopId, sequenceOrder) => {
      await itinerariesApi.reorderStop(itineraryId, stopId, sequenceOrder);
      await refresh();
    },
    [itineraryId, refresh]
  );

  return { itinerary, loading, error, refresh, reorderStop };
}
