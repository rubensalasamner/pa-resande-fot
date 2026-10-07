CREATE TABLE pois (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  latitude REAL NOT NULL,
  longitude REAL NOT NULL,
  radius INTEGER NOT NULL DEFAULT 500,
  fact TEXT NOT NULL,
  category TEXT,
  source_url TEXT,
  updated_at TEXT NOT NULL
);

CREATE INDEX idx_pois_lat_lon ON pois (latitude, longitude);

CREATE TABLE narrations (
  poi_id TEXT NOT NULL,
  voice_id TEXT NOT NULL,
  script_hash TEXT NOT NULL,
  r2_key TEXT,
  status TEXT NOT NULL CHECK (status IN ('pending', 'ready', 'failed')),
  error TEXT,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (poi_id, voice_id, script_hash),
  FOREIGN KEY (poi_id) REFERENCES pois (id)
);

CREATE INDEX idx_narrations_status ON narrations (status);

CREATE TABLE routes (
  id TEXT PRIMARY KEY,
  origin TEXT NOT NULL,
  destination TEXT NOT NULL,
  interval_km REAL NOT NULL,
  geometry_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE route_pois (
  route_id TEXT NOT NULL,
  poi_id TEXT NOT NULL,
  order_index INTEGER NOT NULL,
  distance_along_m REAL NOT NULL DEFAULT 0,
  PRIMARY KEY (route_id, poi_id),
  FOREIGN KEY (route_id) REFERENCES routes (id),
  FOREIGN KEY (poi_id) REFERENCES pois (id)
);

CREATE INDEX idx_route_pois_order ON route_pois (route_id, order_index);
