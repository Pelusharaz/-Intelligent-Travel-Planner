import client from './client';

export const createTrip = (payload) => client.post('/trips', payload).then((r) => r.data);
export const listTrips = () => client.get('/trips').then((r) => r.data);
export const getTrip = (id) => client.get(`/trips/${id}`).then((r) => r.data);
export const updateTrip = (id, payload) => client.patch(`/trips/${id}`, payload).then((r) => r.data);
export const deleteTrip = (id) => client.delete(`/trips/${id}`);
export const generateItinerary = (tripId) =>
  client.post(`/trips/${tripId}/generate`).then((r) => r.data);
export const getTripItinerary = (tripId) =>
  client.get(`/trips/${tripId}/itinerary`).then((r) => r.data);
