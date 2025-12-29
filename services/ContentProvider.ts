import { PointOfInterest } from '@/types';

export class ContentProvider {
  private pois: PointOfInterest[] = [];

  constructor() {
    this.loadPOIs();
  }

  private loadPOIs() {
    // MVP: Load from local JSON
    // Using require() for better React Native/Metro compatibility
    try {
      const poisData = require('@/data/pois.json');
      this.pois = Array.isArray(poisData) ? poisData : [];
    } catch (error) {
      console.error('Failed to load POIs:', error);
      this.pois = []; // Fallback to empty array
    }
  }

  getAllPOIs(): PointOfInterest[] {
    // Reload POIs each time to get fresh data (hot reload support)
    this.loadPOIs();
    return this.pois;
  }

  getPOIById(id: string): PointOfInterest | undefined {
    return this.pois.find(poi => poi.id === id);
  }

  // Future: async fetchPOIs() { ... }
  // Future: async getPOIsForRegion(region) { ... }
  // Future: async cachePOIs() { ... }
}

