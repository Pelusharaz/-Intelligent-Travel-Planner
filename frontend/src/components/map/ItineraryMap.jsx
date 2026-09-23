import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import { Fragment, useEffect } from 'react';
import L from 'leaflet';
import { DAY_COLORS } from '../itinerary/DayCard';

// Leaflet's default marker icons reference image files that don't resolve
// correctly through bundlers - build simple colored circle DivIcons instead.
function dayIcon(color, label) {
  return L.divIcon({
    html: `<div style="
      background:${color};
      width:26px;height:26px;border-radius:50%;
      display:flex;align-items:center;justify-content:center;
      color:white;font-size:12px;font-weight:700;
      border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.4);
    ">${label}</div>`,
    className: '',
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  });
}

function FitBounds({ points }) {
  const map = useMap();
  useEffect(() => {
    if (points.length > 0) {
      map.fitBounds(points, { padding: [40, 40] });
    }
  }, [points, map]);
  return null;
}

export default function ItineraryMap({ destination, days, height = '500px' }) {
  const center = destination ? [destination.lat, destination.lng] : [0, 0];
  const allPoints = [];

  days.forEach((day) => {
    day.stops.forEach((stop) => {
      if (stop.poi?.lat && stop.poi?.lng) {
        allPoints.push([stop.poi.lat, stop.poi.lng]);
      }
    });
  });

  return (
    <div style={{ height }} className="overflow-hidden rounded-2xl border border-slate-200">
      <MapContainer center={center} zoom={13} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitBounds points={allPoints.length > 0 ? allPoints : [center]} />

        {days.map((day) => {
          const color = DAY_COLORS[(day.day_number - 1) % DAY_COLORS.length];
          const sorted = [...day.stops].sort((a, b) => a.sequence_order - b.sequence_order);
          const linePoints = sorted
            .filter((s) => s.poi?.lat && s.poi?.lng)
            .map((s) => [s.poi.lat, s.poi.lng]);

          return (
            <Fragment key={day.id}>
              {linePoints.length > 1 && (
                <Polyline positions={linePoints} pathOptions={{ color, weight: 3, opacity: 0.7 }} />
              )}
              {sorted.map((stop, idx) =>
                stop.poi?.lat && stop.poi?.lng ? (
                  <Marker
                    key={stop.id}
                    position={[stop.poi.lat, stop.poi.lng]}
                    icon={dayIcon(color, `${day.day_number}.${idx + 1}`)}
                  >
                    <Popup>
                      <strong>{stop.poi.name}</strong>
                      <br />
                      Day {day.day_number} · Stop {idx + 1}
                      <br />
                      {stop.estimated_arrival?.slice(0, 5)} · {stop.estimated_duration_minutes} min
                    </Popup>
                  </Marker>
                ) : null
              )}
            </Fragment>
          );
        })}
      </MapContainer>
    </div>
  );
}
