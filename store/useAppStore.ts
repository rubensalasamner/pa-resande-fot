import { create } from "zustand";
import {
  ActiveRoute,
  AppState,
  Location,
  PointOfInterest,
} from "@/types";

interface AppStore extends AppState {
  setDriving: (isDriving: boolean) => void;
  setCurrentLocation: (location: Location | null) => void;
  setNearbyPOIs: (pois: PointOfInterest[]) => void;
  setActiveRoute: (route: ActiveRoute | null) => void;
}

export const useAppStore = create<AppStore>((set) => ({
  isDriving: false,
  currentLocation: null,
  nearbyPOIs: [],
  activeRoute: null,

  setDriving: (isDriving) => set({ isDriving }),
  setCurrentLocation: (location) => set({ currentLocation: location }),
  setNearbyPOIs: (pois) => set({ nearbyPOIs: pois }),
  setActiveRoute: (route) => set({ activeRoute: route }),
}));
