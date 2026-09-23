-- Intelligent Travel Planner - PostgreSQL Schema
-- Matches Development Prompt Section 4

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Users
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Trips (top-level container for one planned trip)
CREATE TABLE IF NOT EXISTS trips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  destination_name VARCHAR(255) NOT NULL,
  destination_lat DECIMAL(9,6),
  destination_lng DECIMAL(9,6),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  budget_total DECIMAL(10,2),
  budget_currency VARCHAR(3) DEFAULT 'USD',
  status VARCHAR(20) DEFAULT 'draft', -- draft | generated | confirmed
  created_at TIMESTAMP DEFAULT NOW()
);

-- Preferences (interest tags + weights per trip)
CREATE TABLE IF NOT EXISTS trip_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID REFERENCES trips(id) ON DELETE CASCADE,
  interest_tag VARCHAR(50) NOT NULL, -- e.g. 'museums', 'nature', 'nightlife'
  weight SMALLINT DEFAULT 5 -- 1-10 scale, user-adjustable
);

-- Points of Interest cache (avoid re-querying Places API repeatedly)
CREATE TABLE IF NOT EXISTS points_of_interest (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  external_place_id VARCHAR(255) UNIQUE, -- Google Places place_id (or synthetic id for mock/OSM)
  name VARCHAR(255) NOT NULL,
  category VARCHAR(50),
  lat DECIMAL(9,6),
  lng DECIMAL(9,6),
  price_level SMALLINT, -- 0-4
  rating DECIMAL(2,1),
  avg_visit_minutes INT DEFAULT 90,
  outdoor BOOLEAN DEFAULT FALSE,
  raw_data JSONB, -- cache full API response
  fetched_at TIMESTAMP DEFAULT NOW()
);

-- Itineraries (one generated plan per trip; supports regeneration/versioning)
CREATE TABLE IF NOT EXISTS itineraries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID REFERENCES trips(id) ON DELETE CASCADE,
  version INT DEFAULT 1,
  generated_at TIMESTAMP DEFAULT NOW()
);

-- Itinerary days
CREATE TABLE IF NOT EXISTS itinerary_days (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  itinerary_id UUID REFERENCES itineraries(id) ON DELETE CASCADE,
  day_number INT NOT NULL,
  date DATE NOT NULL,
  weather_summary VARCHAR(100),
  weather_temp_c DECIMAL(4,1)
);

-- Itinerary stops (ordered POIs within a day)
CREATE TABLE IF NOT EXISTS itinerary_stops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  itinerary_day_id UUID REFERENCES itinerary_days(id) ON DELETE CASCADE,
  poi_id UUID REFERENCES points_of_interest(id),
  sequence_order INT NOT NULL,
  estimated_arrival TIME,
  estimated_duration_minutes INT,
  travel_minutes_from_prev INT
);

-- Refresh tokens (supports JWT access + refresh pattern, token revocation)
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  token VARCHAR(512) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  revoked BOOLEAN DEFAULT FALSE
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_trips_user_id ON trips(user_id);
CREATE INDEX IF NOT EXISTS idx_trip_preferences_trip_id ON trip_preferences(trip_id);
CREATE INDEX IF NOT EXISTS idx_itinerary_stops_day_seq ON itinerary_stops(itinerary_day_id, sequence_order);
CREATE INDEX IF NOT EXISTS idx_poi_category ON points_of_interest(category);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);
