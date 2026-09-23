# Intelligent Travel Planner

A full-stack web app that generates personalised, day-by-day travel itineraries
using a hybrid rule-based + weighted-ranking recommendation engine, distance-aware
stop ordering, and weather-aware adjustments — built per the *Development Prompt:
Intelligent Travel Planner Web Application* spec.

## Stack (as specified)

| Layer     | Choice                                   |
|-----------|-------------------------------------------|
| Frontend  | React + Tailwind CSS (Vite)               |
| Backend   | Node.js + Express.js (REST API)           |
| Database  | PostgreSQL                                |
| Maps      | OpenStreetMap + Leaflet (mock POI data by default; swap in Google Maps API by setting `GOOGLE_MAPS_API_KEY`) |
| Weather   | OpenWeatherMap (mock forecasts by default; set `OPENWEATHER_API_KEY` to go live) |
| Auth      | JWT (access + refresh tokens), bcrypt password hashing |

**Note on external APIs:** no API keys were supplied, so `placesService.js` and
`weatherService.js` ship with deterministic mock data providers so the full
pipeline (candidate generation → scoring → distance ordering → weather
adjustment) works out of the box. Drop a real key into `backend/.env` and the
same functions automatically switch to live Google Places/Geocoding and
OpenWeatherMap calls — no other code changes needed. Amadeus flight search
was scoped in the spec's stack table but no endpoints referencing it appear
in the Section 5 API contract, so it isn't wired into a route; add
`backend/src/services/flightsService.js` following the same adapter pattern
if/when you need it.

## Project layout

```
travel-planner/
├── backend/                 # Express REST API
│   ├── src/
│   │   ├── config/db.js         # Postgres pool
│   │   ├── middleware/auth.js   # JWT verification
│   │   ├── routes/              # auth, trips, itineraries, places, weather
│   │   ├── services/            # recommendation engine, distance, places, weather
│   │   ├── db/schema.sql        # Section 4 schema, applied automatically below
│   │   └── index.js             # app entrypoint
│   └── tests/                   # Jest unit tests for the recommendation engine
├── frontend/                # React + Tailwind SPA (Vite)
│   └── src/
│       ├── api/                 # one axios file per resource
│       ├── components/forms/    # PreferenceWizard, BudgetSlider, DateRangePicker
│       ├── components/itinerary/# DayCard, StopCard
│       ├── components/map/      # ItineraryMap (Leaflet)
│       ├── context/AuthContext.jsx
│       ├── hooks/                # useTrips, useItinerary
│       └── pages/                # Login, Register, Dashboard, TripCreate, TripDetail
└── .github/workflows/ci.yml  # lint/test on PR (Section 8 checklist item)
```

## 1. Prerequisites

- Node.js 20+ and npm
- PostgreSQL 14+ running locally (or a managed instance)

## 2. Database setup

```bash
# create the database
createdb travel_planner

# apply the schema (Section 4)
psql -U postgres -d travel_planner -f backend/src/db/schema.sql

```

If you're starting Postgres fresh, make sure the `pgcrypto` extension is
available — the schema enables it automatically (`CREATE EXTENSION IF NOT
EXISTS pgcrypto;`), which is what powers `gen_random_uuid()` for all primary keys.

## 3. Backend setup

```bash
cd backend
cp .env.example .env cls    # then edit DATABASE_URL / JWT secrets
# node -e "console.log(require('crypto').randomBytes(32).toString('hex'))" -- code generator
npm install
npm run dev               # nodemon, http://localhost:4000
```

Health check: `curl http://localhost:4000/api/health`

Run the recommendation-engine unit tests:

```bash
npm test
```

### Environment variables (`backend/.env`)

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | yes | `postgresql://user:pass@host:5432/travel_planner` |
| `JWT_SECRET` / `JWT_REFRESH_SECRET` | yes | any long random strings for dev |
| `GOOGLE_MAPS_API_KEY` | no | leave blank to use the mock Places/Geocoding provider |
| `OPENWEATHER_API_KEY` | no | leave blank to use the mock forecast provider |
| `AMADEUS_CLIENT_ID` / `AMADEUS_CLIENT_SECRET` | no | reserved for a future `/api/flights` route |
| `CORS_ORIGIN` | yes | set to the frontend's origin, e.g. `http://localhost:5173` |

## 4. Frontend setup

```bash
cd frontend
npm install
npm run dev                # http://localhost:5173
#npm install @rolldown/binding-win32-x64-msvc -- bundler issue
```

`frontend/.env` points the SPA at the backend:

```
VITE_API_URL=http://localhost:4000/api
```

## 5. Using the app

1. Register an account (`/register`). #pelunguta@gmail.com, 0204pelusharaz
2. Click **New trip** → walk through the 4-step wizard (destination → dates →
   budget → interests with weight sliders).
3. On submit, the trip is created and the recommendation engine runs
   immediately, generating a day-by-day itinerary.
4. On the trip page, switch between **list** view (day tabs, drag-to-reorder
   stops) and **map** view (colour-coded markers/routes per day), or hit
   **Regenerate itinerary** to re-run the engine (creates a new version).

## API contract

See `backend/src/routes/*.js` — implements Section 5 of the dev prompt
exactly (`/api/auth/*`, `/api/trips*`, `/api/itineraries/*`,
`/api/places/search`, `/api/weather/forecast`), plus one convenience
addition: `GET /api/trips/:id/itinerary` (fetches the latest generated
itinerary for a trip, used by the dashboard → trip-detail flow).

## Recommendation engine (Section 6)

Implemented in `backend/src/services/recommendationEngine.js`:

- **6.1 Candidate generation** — one Places query per interest tag,
  deduplicated by `external_place_id`, filtered against a budget-derived
  target price level.
- **6.2 Scoring** — `score = 0.5·interest_match + 0.25·normalized_rating +
  0.15·budget_fit − 0.1·redundancy_penalty` (tunable via the `WEIGHTS`
  constant at the top of the file).
- **6.3 Distance-aware ordering** — Haversine-based nearest-neighbour TSP
  heuristic (`services/distanceService.js`), anchored at the destination
  centroid; the lowest-scoring stop is dropped if a day would exceed the
  9-hour activity budget.
- **6.4 Weather adjustment** — days with >50% precipitation probability or
  extreme temperature swap `outdoor: true` stops for the best available
  indoor alternative still in the candidate pool.

## Deployment (Section 2 pairing)

- **Frontend → Vercel**: point it at the `frontend/` directory, set
  `VITE_API_URL` to your deployed backend URL.
- **Backend → Render/Heroku/AWS**: set the environment variables above,
  point `DATABASE_URL` at a managed Postgres instance (e.g. RDS), and run
  `npm start`.

## What's stubbed vs. live

Everything in the request/response pipeline is real and working end-to-end
against a live Postgres database — auth, persistence, scoring, ordering,
and weather logic all run for real. The only mocked pieces are the *external
data sources themselves* (Google Places/Geocoding, OpenWeatherMap), because
no API keys were provided. Supplying real keys in `backend/.env` activates
the corresponding live branch in `placesService.js` / `weatherService.js`
with no other changes required.
