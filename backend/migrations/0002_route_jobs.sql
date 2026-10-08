ALTER TABLE routes ADD COLUMN status TEXT NOT NULL DEFAULT 'finalized' CHECK (status IN ('collecting', 'finalized', 'failed'));
ALTER TABLE routes ADD COLUMN voice_id TEXT;
ALTER TABLE routes ADD COLUMN error TEXT;

CREATE TABLE route_collect_jobs (
  route_id TEXT NOT NULL,
  job_index INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'done', 'failed')),
  error TEXT,
  PRIMARY KEY (route_id, job_index),
  FOREIGN KEY (route_id) REFERENCES routes (id)
);

DROP TABLE route_pois;

CREATE TABLE route_pois (
  route_id TEXT NOT NULL,
  poi_id TEXT NOT NULL,
  distance_along_m REAL NOT NULL,
  distance_to_route_m REAL NOT NULL,
  trigger_radius_m INTEGER NOT NULL,
  selected INTEGER NOT NULL DEFAULT 0,
  script_hash TEXT,
  PRIMARY KEY (route_id, poi_id),
  FOREIGN KEY (route_id) REFERENCES routes (id),
  FOREIGN KEY (poi_id) REFERENCES pois (id)
);

CREATE INDEX idx_route_pois_along ON route_pois (route_id, distance_along_m);
