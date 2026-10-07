import type { PoiDto } from "../../shared/apiTypes";
import { boundingBox, haversineMeters } from "./domain/geo";

export interface PoiRow {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radius: number;
  fact: string;
  category: string | null;
  source_url: string | null;
  r2_key?: string | null;
  narration_status?: string | null;
}

export function toPoiDto(row: PoiRow, origin?: string): PoiDto {
  const audioUrl =
    row.narration_status === "ready" && row.r2_key
      ? `${origin ?? ""}/audio/${row.r2_key
          .split("/")
          .map(encodeURIComponent)
          .join("/")}`
      : undefined;

  return {
    id: row.id,
    name: row.name,
    latitude: row.latitude,
    longitude: row.longitude,
    radius: row.radius,
    fact: row.fact,
    category: row.category ?? undefined,
    sourceUrl: row.source_url ?? undefined,
    audioUrl,
  };
}

export async function queryPoisNear(
  db: D1Database,
  lat: number,
  lon: number,
  radiusM: number,
  voiceId: string
): Promise<PoiRow[]> {
  const box = boundingBox({ lat, lon }, radiusM);
  const rows = await db
    .prepare(
      `SELECT p.*, n.r2_key, n.status AS narration_status
       FROM pois p
       LEFT JOIN narrations n
         ON n.poi_id = p.id AND n.voice_id = ? AND n.status = 'ready'
       WHERE p.latitude BETWEEN ? AND ?
         AND p.longitude BETWEEN ? AND ?`
    )
    .bind(voiceId, box.minLat, box.maxLat, box.minLon, box.maxLon)
    .all<PoiRow>();

  return (rows.results ?? []).filter((row) => {
    const distance = haversineMeters(
      { lat, lon },
      { lat: row.latitude, lon: row.longitude }
    );
    return distance <= radiusM;
  });
}
