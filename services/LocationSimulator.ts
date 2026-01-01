import { Location as LocationType } from '@/types';

export class LocationSimulator {
  private intervalId: NodeJS.Timeout | null = null;
  private onLocationUpdate?: (location: LocationType) => void;
  private isSimulating: boolean = false;
  private currentRoute: LocationType[] = [];
  private currentIndex: number = 0;

  /**
   * Set a single location (for testing specific POIs)
   */
  setLocation(lat: number, lon: number) {
    const location: LocationType = {
      latitude: lat,
      longitude: lon,
      accuracy: 10,
      timestamp: Date.now(),
    };
    this.onLocationUpdate?.(location);
  }

  /**
   * Simulate movement along a route
   */
  startRouteSimulation(
    route: Array<{ lat: number; lon: number }>,
    intervalMs: number = 2000,
    onUpdate?: (location: LocationType) => void
  ) {
    if (this.isSimulating) {
      this.stopSimulation();
    }

    this.onLocationUpdate = onUpdate;
    this.currentRoute = route.map((point) => ({
      latitude: point.lat,
      longitude: point.lon,
      accuracy: 10,
      timestamp: Date.now(),
    }));
    this.currentIndex = 0;
    this.isSimulating = true;

    // Send first location immediately
    if (this.currentRoute.length > 0) {
      this.onLocationUpdate?.(this.currentRoute[0]);
    }

    // Then move through the route
    this.intervalId = setInterval(() => {
      this.currentIndex++;
      if (this.currentIndex >= this.currentRoute.length) {
        this.currentIndex = 0; // Loop back to start
      }
      const location = {
        ...this.currentRoute[this.currentIndex],
        timestamp: Date.now(),
      };
      this.onLocationUpdate?.(location);
    }, intervalMs);
  }

  /**
   * Stop simulation
   */
  stopSimulation() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.isSimulating = false;
  }

  isActive(): boolean {
    return this.isSimulating;
  }
}

