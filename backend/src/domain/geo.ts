import type { LatLng } from "../providers/types";

const EARTH_RADIUS_M = 6371e3;
const METERS_PER_DEGREE_LAT = 111_320;
const MAX_WIKIPEDIA_RADIUS_M = 10_000;

/** [lon, lat, distance along the route in meters] */
export type PathPoint = [number, number, number];

export interface RouteSample extends LatLng {
  alongM: number;
}

export interface PathProjection {
  distanceM: number;
  alongM: number;
}

export function haversineMeters(a: LatLng, b: LatLng): number {
  const φ1 = (a.lat * Math.PI) / 180;
  const φ2 = (b.lat * Math.PI) / 180;
  const Δφ = ((b.lat - a.lat) * Math.PI) / 180;
  const Δλ = ((b.lon - a.lon) * Math.PI) / 180;

  const sinΔφ = Math.sin(Δφ / 2);
  const sinΔλ = Math.sin(Δλ / 2);
  const h =
    sinΔφ * sinΔφ + Math.cos(φ1) * Math.cos(φ2) * sinΔλ * sinΔλ;
  return 2 * EARTH_RADIUS_M * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export function boundingBox(
  point: LatLng,
  radiusM: number
): { minLat: number; maxLat: number; minLon: number; maxLon: number } {
  const latDelta = radiusM / METERS_PER_DEGREE_LAT;
  const lonDelta =
    radiusM /
    (METERS_PER_DEGREE_LAT * Math.cos((point.lat * Math.PI) / 180) || 1e-6);

  return {
    minLat: point.lat - latDelta,
    maxLat: point.lat + latDelta,
    minLon: point.lon - lonDelta,
    maxLon: point.lon + lonDelta,
  };
}

function roundCoord(value: number): number {
  return Math.round(value * 1e5) / 1e5;
}

/**
 * Reduce a GeoJSON LineString ([lon, lat][]) to points at least minSpacingM apart,
 * keeping true along-road distance.
 */
export function decimateLineString(
  coordinates: Array<[number, number]>,
  minSpacingM: number
): PathPoint[] {
  if (coordinates.length === 0) return [];

  const [firstLon, firstLat] = coordinates[0];
  const path: PathPoint[] = [[roundCoord(firstLon), roundCoord(firstLat), 0]];
  let prev: LatLng = { lon: firstLon, lat: firstLat };
  let alongM = 0;
  let sinceKeptM = 0;

  for (let i = 1; i < coordinates.length; i++) {
    const curr: LatLng = { lon: coordinates[i][0], lat: coordinates[i][1] };
    const segmentM = haversineMeters(prev, curr);
    alongM += segmentM;
    sinceKeptM += segmentM;
    prev = curr;

    if (sinceKeptM >= minSpacingM || i === coordinates.length - 1) {
      path.push([roundCoord(curr.lon), roundCoord(curr.lat), Math.round(alongM)]);
      sinceKeptM = 0;
    }
  }

  return path;
}

function interpolate(a: PathPoint, b: PathPoint, atM: number): RouteSample {
  const span = b[2] - a[2];
  const t = span > 0 ? (atM - a[2]) / span : 0;
  return {
    lon: roundCoord(a[0] + (b[0] - a[0]) * t),
    lat: roundCoord(a[1] + (b[1] - a[1]) * t),
    alongM: Math.round(atM),
  };
}

/** Points every spacingM along the path, always including start and end. */
export function samplePath(path: PathPoint[], spacingM: number): RouteSample[] {
  if (spacingM <= 0) {
    throw new Error("spacingM must be > 0");
  }
  if (path.length === 0) return [];
  if (path.length === 1) {
    return [{ lon: path[0][0], lat: path[0][1], alongM: 0 }];
  }

  const totalM = path[path.length - 1][2];
  const samples: RouteSample[] = [];
  let segment = 0;

  for (let atM = 0; atM <= totalM; atM += spacingM) {
    while (segment < path.length - 2 && path[segment + 1][2] < atM) {
      segment++;
    }
    samples.push(interpolate(path[segment], path[segment + 1], atM));
  }

  const lastAlong = samples[samples.length - 1].alongM;
  if (totalM - lastAlong > spacingM / 4) {
    const end = path[path.length - 1];
    samples.push({ lon: end[0], lat: end[1], alongM: totalM });
  }

  return samples;
}

/** Sub-path covering [fromM, toM] along the route, including the bounding points. */
export function slicePath(
  path: PathPoint[],
  fromM: number,
  toM: number
): PathPoint[] {
  let start = 0;
  while (start < path.length - 1 && path[start + 1][2] <= fromM) start++;
  let end = path.length - 1;
  while (end > start && path[end - 1][2] >= toM) end--;
  return path.slice(start, end + 1);
}

/** Closest point on the path to `point`, using a local equirectangular projection. */
export function nearestOnPath(path: PathPoint[], point: LatLng): PathProjection {
  if (path.length === 0) {
    throw new Error("path is empty");
  }

  const metersPerDegreeLon =
    METERS_PER_DEGREE_LAT * Math.cos((point.lat * Math.PI) / 180);
  const x = (p: PathPoint) => (p[0] - point.lon) * metersPerDegreeLon;
  const y = (p: PathPoint) => (p[1] - point.lat) * METERS_PER_DEGREE_LAT;

  let best: PathProjection = {
    distanceM: Math.hypot(x(path[0]), y(path[0])),
    alongM: path[0][2],
  };

  for (let i = 1; i < path.length; i++) {
    const ax = x(path[i - 1]);
    const ay = y(path[i - 1]);
    const dx = x(path[i]) - ax;
    const dy = y(path[i]) - ay;
    const lengthSq = dx * dx + dy * dy;
    const t =
      lengthSq === 0
        ? 0
        : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / lengthSq));
    const distanceM = Math.hypot(ax + t * dx, ay + t * dy);

    if (distanceM < best.distanceM) {
      best = {
        distanceM,
        alongM: path[i - 1][2] + t * (path[i][2] - path[i - 1][2]),
      };
    }
  }

  return best;
}

/**
 * Sample spacing and search radius so that circles centered on the samples
 * cover a corridor of halfWidthM on both sides of the route.
 */
export function corridorSampling(halfWidthM: number): {
  spacingM: number;
  searchRadiusM: number;
} {
  const searchRadiusM = Math.min(
    Math.ceil(halfWidthM * Math.SQRT2),
    MAX_WIKIPEDIA_RADIUS_M
  );
  const halfSpacingM = Math.sqrt(
    Math.max(searchRadiusM ** 2 - halfWidthM ** 2, 0)
  );
  return { spacingM: Math.max(Math.floor(2 * halfSpacingM), 100), searchRadiusM };
}
