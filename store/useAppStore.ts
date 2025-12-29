import { create } from 'zustand';
import { AppState, Location, PointOfInterest } from '@/types';

interface AppStore extends AppState {
  setDriving: (isDriving: boolean) => void;
  setCurrentLocation: (location: Location | null) => void;
  setNearbyPOIs: (pois: PointOfInterest[]) => void;
  setLastNarratedPOI: (poiId: string | null) => void;
  addToNarrationQueue: (text: string) => void;
  clearNarrationQueue: () => void;
}

export const useAppStore = create<AppStore>((set) => ({
  isDriving: false,
  currentLocation: null,
  nearbyPOIs: [],
  lastNarratedPOI: null,
  narrationQueue: [],

  setDriving: (isDriving) => set({ isDriving }),
  setCurrentLocation: (location) => set({ currentLocation: location }),
  setNearbyPOIs: (pois) => set({ nearbyPOIs: pois }),
  setLastNarratedPOI: (poiId) => set({ lastNarratedPOI: poiId }),
  addToNarrationQueue: (text) =>
    set((state) => ({
      narrationQueue: [...state.narrationQueue, text],
    })),
  clearNarrationQueue: () => set({ narrationQueue: [] }),
}));

