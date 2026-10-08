import { routePackStore } from "@/services/RoutePackStore";
import {
  ActiveRoute,
  AppState,
  Location,
  PointOfInterest,
} from "@/types";
import { create } from "zustand";

interface AppStore extends AppState {
  hydrated: boolean;
  setDriving: (isDriving: boolean) => void;
  setCurrentLocation: (location: Location | null) => void;
  setNearbyPOIs: (pois: PointOfInterest[]) => void;
  setActiveRoute: (route: ActiveRoute | null) => void;
  clearActiveRoute: () => Promise<void>;
  hydrateActiveRoute: () => Promise<void>;
}

export const useAppStore = create<AppStore>((set) => ({
  isDriving: false,
  currentLocation: null,
  nearbyPOIs: [],
  activeRoute: null,
  hydrated: false,

  setDriving: (isDriving) => set({ isDriving }),
  setCurrentLocation: (location) => set({ currentLocation: location }),
  setNearbyPOIs: (pois) => set({ nearbyPOIs: pois }),
  setActiveRoute: (route) => {
    set({ activeRoute: route });
    if (route) {
      void routePackStore.setActiveRouteId(route.routeId);
    }
  },
  clearActiveRoute: async () => {
    await routePackStore.clearActiveRoute();
    set({ activeRoute: null });
  },
  hydrateActiveRoute: async () => {
    const route = await routePackStore.restoreActiveRoute();
    set({ activeRoute: route, hydrated: true });
  },
}));
