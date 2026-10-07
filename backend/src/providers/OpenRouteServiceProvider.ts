import type { LatLng, RouteGeometry, RouteProvider } from "./types";

export class OpenRouteServiceProvider implements RouteProvider {
  constructor(private readonly apiKey: string) {}

  async geocode(query: string): Promise<LatLng> {
    const url = new URL("https://api.openrouteservice.org/geocode/search");
    url.searchParams.set("api_key", this.apiKey);
    url.searchParams.set("text", query);
    url.searchParams.set("size", "1");
    url.searchParams.set("boundary.country", "SE");

    const res = await fetch(url.toString());
    if (!res.ok) {
      throw new Error(`ORS geocode failed: ${res.status} ${await res.text()}`);
    }

    const data = (await res.json()) as {
      features?: Array<{ geometry?: { coordinates?: number[] } }>;
    };
    const coords = data.features?.[0]?.geometry?.coordinates;
    if (!coords || coords.length < 2) {
      throw new Error(`Could not geocode: ${query}`);
    }

    return { lon: coords[0], lat: coords[1] };
  }

  async getDrivingRoute(
    origin: LatLng,
    destination: LatLng
  ): Promise<RouteGeometry> {
    const res = await fetch(
      "https://api.openrouteservice.org/v2/directions/driving-car/geojson",
      {
        method: "POST",
        headers: {
          Authorization: this.apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          coordinates: [
            [origin.lon, origin.lat],
            [destination.lon, destination.lat],
          ],
        }),
      }
    );

    if (!res.ok) {
      throw new Error(`ORS directions failed: ${res.status} ${await res.text()}`);
    }

    const data = (await res.json()) as {
      features?: Array<{
        geometry?: { coordinates?: Array<[number, number]> };
        properties?: { summary?: { distance?: number } };
      }>;
    };

    const feature = data.features?.[0];
    const coordinates = feature?.geometry?.coordinates;
    if (!coordinates || coordinates.length < 2) {
      throw new Error("ORS returned no route geometry");
    }

    return {
      coordinates,
      distanceM: feature?.properties?.summary?.distance ?? 0,
    };
  }
}
