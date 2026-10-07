export interface LatLng {
  lat: number;
  lon: number;
}

export interface RouteGeometry {
  coordinates: Array<[number, number]>; // [lon, lat] GeoJSON order
  distanceM: number;
}

export interface RouteProvider {
  geocode(query: string): Promise<LatLng>;
  getDrivingRoute(origin: LatLng, destination: LatLng): Promise<RouteGeometry>;
}

export interface RawPoi {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  fact: string;
  category?: string;
  sourceUrl?: string;
}

export interface PoiSource {
  findNear(point: LatLng, radiusM: number): Promise<RawPoi[]>;
}

export interface ScriptWriter {
  write(rawFact: string, name: string): string;
}

export interface TtsProvider {
  synthesize(text: string, voiceId: string): Promise<ArrayBuffer>;
}

export interface AudioStore {
  put(key: string, data: ArrayBuffer, contentType?: string): Promise<void>;
  get(key: string): Promise<ReadableStream | null>;
  keyFor(voiceId: string, poiId: string, scriptHash: string): string;
}
