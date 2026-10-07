import { apiClient } from "@/services/ApiClient";
import { PointOfInterest } from "@/types";

export class ContentProvider {
  private pois: PointOfInterest[] = [];

  private loadPOIs() {
    try {
      const poisData = require("@/data/pois.json");
      this.pois = Array.isArray(poisData) ? poisData : [];
    } catch (error) {
      console.error("Failed to load POIs:", error);
      this.pois = [];
    }
  }

  async fetchPOIsFromAPI(
    lat: number,
    lon: number,
    radius: number = 5000
  ): Promise<PointOfInterest[]> {
    try {
      const apiPOIs = await apiClient.getPois(lat, lon, radius);
      this.pois = apiPOIs;
      return apiPOIs;
    } catch (error) {
      console.error("Failed to fetch POIs from API:", error);
      this.loadPOIs();
      return this.pois;
    }
  }

  getAllPOIs(): PointOfInterest[] {
    this.loadPOIs();
    return this.pois;
  }

  getPOIById(id: string): PointOfInterest | undefined {
    return this.pois.find((poi) => poi.id === id);
  }
}
