import { PointOfInterest } from "@/types";

// Update this with your Vercel API URL
// You can also set EXPO_PUBLIC_API_URL in .env file
// Example: EXPO_PUBLIC_API_URL=https://your-api.vercel.app
const API_URL =
  process.env.EXPO_PUBLIC_API_URL || "https://your-vercel-api.vercel.app";

export class ContentProvider {
  private pois: PointOfInterest[] = [];
  private apiUrl: string;

  constructor() {
    this.apiUrl = API_URL;
    // Don't load on init - will load when needed
  }

  private loadPOIs() {
    // MVP: Load from local JSON (fallback)
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
      // Remove trailing slash from apiUrl if present
      const baseUrl = this.apiUrl.replace(/\/$/, "");
      const url = `${baseUrl}/api/pois?lat=${lat}&lon=${lon}&radius=${radius}`;
      console.log("Fetching POIs from API:", url);

      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      const apiPOIs = (data.pois || []).map((poi: any) => ({
        id: poi.id,
        name: poi.name,
        fact: poi.fact,
        latitude: poi.latitude,
        longitude: poi.longitude,
        radius: poi.radius || 200,
        category: poi.category,
      }));

      console.log(`Fetched ${apiPOIs.length} POIs from API`);
      return apiPOIs;
    } catch (error) {
      console.error("Failed to fetch POIs from API:", error);
      // Fallback to local POIs
      this.loadPOIs();
      return this.pois;
    }
  }

  getAllPOIs(): PointOfInterest[] {
    // For now, return local POIs (will be replaced by API fetch)
    this.loadPOIs();
    return this.pois;
  }

  getPOIById(id: string): PointOfInterest | undefined {
    return this.pois.find((poi) => poi.id === id);
  }
}
