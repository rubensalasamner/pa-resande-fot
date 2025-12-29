export interface PointOfInterest {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radius: number; // in meters - how close you need to be
  fact: string; // The text to narrate
  category?: string;
}

export interface Location {
  latitude: number;
  longitude: number;
  accuracy: number | null;
  timestamp: number;
}

export interface AppState {
  isDriving: boolean;
  currentLocation: Location | null;
  nearbyPOIs: PointOfInterest[];
  lastNarratedPOI: string | null;
  narrationQueue: string[];
}

