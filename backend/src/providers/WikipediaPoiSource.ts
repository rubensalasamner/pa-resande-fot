import type { LatLng, PoiSource, RawPoi } from "./types";

const USER_AGENT =
  "pa-resande-fot/1.0 (https://github.com/rubensalasamner/pa-resande-fot; travel guide)";

export class RateLimitedError extends Error {
  constructor(
    message: string,
    readonly retryAfterSeconds: number
  ) {
    super(message);
    this.name = "RateLimitedError";
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class WikipediaPoiSource implements PoiSource {
  constructor(private readonly lang: string = "sv") {}

  async findNear(point: LatLng, radiusM: number): Promise<RawPoi[]> {
    const radius = Math.min(Math.max(Math.round(radiusM), 10), 10000);
    const url = new URL(`https://${this.lang}.wikipedia.org/w/api.php`);
    url.searchParams.set("action", "query");
    url.searchParams.set("format", "json");
    url.searchParams.set("origin", "*");
    url.searchParams.set("generator", "geosearch");
    url.searchParams.set("ggscoord", `${point.lat}|${point.lon}`);
    url.searchParams.set("ggsradius", String(radius));
    url.searchParams.set("ggslimit", "20");
    url.searchParams.set("prop", "extracts|coordinates|info");
    url.searchParams.set("exintro", "1");
    url.searchParams.set("explaintext", "1");
    url.searchParams.set("exlimit", "20");
    url.searchParams.set("inprop", "url");

    // One in-request retry for brief 429s; longer backoff is handled by the queue.
    for (let attempt = 0; attempt < 2; attempt++) {
      const res = await fetch(url.toString(), {
        headers: { "User-Agent": USER_AGENT },
      });

      if (res.status === 429) {
        const retryAfter = Number(res.headers.get("retry-after") || 20);
        if (attempt === 0) {
          await sleep(Math.min(Math.max(retryAfter, 5), 30) * 1000);
          continue;
        }
        throw new RateLimitedError(
          `Wikipedia geosearch failed: 429`,
          Math.min(Math.max(retryAfter, 30), 120)
        );
      }

      if (!res.ok) {
        throw new Error(`Wikipedia geosearch failed: ${res.status}`);
      }

      const data = (await res.json()) as {
        query?: {
          pages?: Record<
            string,
            {
              pageid: number;
              title: string;
              extract?: string;
              fullurl?: string;
              coordinates?: Array<{ lat: number; lon: number }>;
            }
          >;
        };
      };

      const pages = Object.values(data.query?.pages ?? {});
      const pois: RawPoi[] = [];

      for (const page of pages) {
        const coord = page.coordinates?.[0];
        if (!coord || !page.extract?.trim()) continue;

        pois.push({
          id: `wiki:${this.lang}:${page.pageid}`,
          name: page.title,
          latitude: coord.lat,
          longitude: coord.lon,
          fact: page.extract.trim(),
          category: "wikipedia",
          sourceUrl:
            page.fullurl ??
            `https://${this.lang}.wikipedia.org/?curid=${page.pageid}`,
        });
      }

      return pois;
    }

    throw new Error("Wikipedia geosearch failed after retries");
  }
}
