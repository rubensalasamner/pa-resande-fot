import type { LatLng } from "../providers/types";

const EARTH_RADIUS_M = 6371e3;

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
  const latDelta = radiusM / 111_320;
  const lonDelta =
    radiusM / (111_320 * Math.cos((point.lat * Math.PI) / 180) || 1e-6);

  return {
    minLat: point.lat - latDelta,
    maxLat: point.lat + latDelta,
    minLon: point.lon - lonDelta,
    maxLon: point.lon + lonDelta,
  };
}

/** Sample points along a GeoJSON LineString ([lon, lat][]) every intervalKm. */
export function sampleLineString(
  coordinates: Array<[number, number]>,
  intervalKm: number
): Array<LatLng & { distanceAlongM: number }> {
  if (coordinates.length === 0) return [];
  if (intervalKm <= 0) {
    throw new Error("intervalKm must be > 0");
  }

  const intervalM = intervalKm * 1000;
  const samples: Array<LatLng & { distanceAlongM: number }> = [];

  const first = coordinates[0];
  samples.push({ lon: first[0], lat: first[1], distanceAlongM: 0 });

  let traveled = 0;
  let nextAt = intervalM;

  for (let i = 1; i < coordinates.length; i++) {
    const prev: LatLng = {
      lon: coordinates[i - 1][0],
      lat: coordinates[i - 1][1],
    };
    const curr: LatLng = { lon: coordinates[i][0], lat: coordinates[i][1] };
    const segLen = haversineMeters(prev, curr);
    if (segLen === 0) continue;

    while (traveled + segLen >= nextAt) {
      const remain = nextAt - traveled;
      const ratio = remain / segLen;
      samples.push({
        lat: prev.lat + (curr.lat - prev.lat) * ratio,
        lon: prev.lon + (curr.lon - prev.lon) * ratio,
        distanceAlongM: nextAt,
      });
      nextAt += intervalM;
    }

    traveled += segLen;
  }

  const last = coordinates[coordinates.length - 1];
  const lastSample = samples[samples.length - 1];
  if (
    !lastSample ||
    haversineMeters(lastSample, { lon: last[0], lat: last[1] }) > 50
  ) {
    samples.push({ lon: last[0], lat: last[1], distanceAlongM: traveled });
  }

  return samples;
}
