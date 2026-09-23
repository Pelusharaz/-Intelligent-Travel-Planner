import client from './client';

export const getItinerary = (id) => client.get(`/itineraries/${id}`).then((r) => r.data);
export const reorderStop = (itineraryId, stopId, sequenceOrder) =>
  client
    .patch(`/itineraries/${itineraryId}/stops/${stopId}`, { sequence_order: sequenceOrder })
    .then((r) => r.data);
