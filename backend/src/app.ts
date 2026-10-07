import { Hono } from "hono";
import { cors } from "hono/cors";
import type {
  PoisListResponse,
  PrepareRouteRequest,
  PrepareRouteResponse,
  RouteStatusResponse,
} from "../../shared/apiTypes";
import { createPrepareDeps } from "./createDeps";
import { prepareRoute } from "./domain/prepareRoute";
import type { Env } from "./env";
import { queryPoisNear, toPoiDto, type PoiRow } from "./poiMapper";
import { R2AudioStore } from "./providers/R2AudioStore";

type AppEnv = { Bindings: Env };

function requestOrigin(c: { req: { url: string } }): string {
  const url = new URL(c.req.url);
  return url.origin;
}

export function createApp() {
  const app = new Hono<AppEnv>();

  app.use("*", cors());

  app.get("/health", (c) => c.json({ ok: true }));

  app.get("/api/pois", async (c) => {
    const lat = Number(c.req.query("lat"));
    const lon = Number(c.req.query("lon"));
    const radius = Number(c.req.query("radius") ?? 5000);

    if (Number.isNaN(lat) || Number.isNaN(lon)) {
      return c.json({ error: "lat and lon are required" }, 400);
    }

    const voiceId = c.env.TTS_VOICE || "sv-SE-Chirp3-HD-Algenib";
    const rows = await queryPoisNear(c.env.DB, lat, lon, radius, voiceId);
    const origin = requestOrigin(c);
    const pois = rows.map((row) => toPoiDto(row, origin));

    const body: PoisListResponse = { success: true, pois };
    return c.json(body);
  });

  app.get("/api/all-pois", async (c) => {
    const voiceId = c.env.TTS_VOICE || "sv-SE-Chirp3-HD-Algenib";
    const result = await c.env.DB.prepare(
      `SELECT p.*, n.r2_key, n.status AS narration_status
       FROM pois p
       LEFT JOIN narrations n
         ON n.poi_id = p.id AND n.voice_id = ? AND n.status = 'ready'`
    )
      .bind(voiceId)
      .all<PoiRow>();

    const origin = requestOrigin(c);
    const pois = (result.results ?? []).map((row) => toPoiDto(row, origin));
    const body: PoisListResponse = { success: true, pois };
    return c.json(body);
  });

  app.post("/api/prepare-route", async (c) => {
    let body: PrepareRouteRequest;
    try {
      body = await c.req.json<PrepareRouteRequest>();
    } catch {
      return c.json({ error: "Invalid JSON body" }, 400);
    }

    if (!body.origin?.trim() || !body.destination?.trim()) {
      return c.json({ error: "origin and destination are required" }, 400);
    }

    const intervalKm = Number(body.intervalKm);
    if (Number.isNaN(intervalKm) || intervalKm < 1 || intervalKm > 20) {
      return c.json({ error: "intervalKm must be between 1 and 20" }, 400);
    }

    if (!c.env.ORS_API_KEY) {
      return c.json(
        { error: "ORS_API_KEY is not configured on the worker" },
        500
      );
    }

    try {
      const deps = createPrepareDeps(c.env);
      const result = await prepareRoute(deps, {
        origin: body.origin.trim(),
        destination: body.destination.trim(),
        intervalKm,
      });

      const response: PrepareRouteResponse = {
        routeId: result.routeId,
        message: `Hittade ${result.articlesSaved} platser längs rutten.`,
        articlesFetched: result.articlesFetched,
        articlesSaved: result.articlesSaved,
        audioPending: result.audioPending,
      };
      return c.json(response);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("prepare-route failed:", message);
      return c.json({ error: "prepare-route failed", message }, 500);
    }
  });

  app.get("/api/routes/:id", async (c) => {
    const routeId = c.req.param("id");
    const voiceId = c.env.TTS_VOICE || "sv-SE-Chirp3-HD-Algenib";

    const route = await c.env.DB.prepare(
      `SELECT id, origin, destination, interval_km FROM routes WHERE id = ?`
    )
      .bind(routeId)
      .first<{
        id: string;
        origin: string;
        destination: string;
        interval_km: number;
      }>();

    if (!route) {
      return c.json({ error: "Route not found" }, 404);
    }

    const result = await c.env.DB.prepare(
      `SELECT p.*, n.r2_key, n.status AS narration_status, rp.order_index
       FROM route_pois rp
       JOIN pois p ON p.id = rp.poi_id
       LEFT JOIN narrations n
         ON n.poi_id = p.id AND n.voice_id = ?
       WHERE rp.route_id = ?
       ORDER BY rp.order_index ASC`
    )
      .bind(voiceId, routeId)
      .all<PoiRow & { order_index: number }>();

    const rows = result.results ?? [];
    const origin = requestOrigin(c);
    const pois = rows.map((row) => toPoiDto(row, origin));

    const withNarration = rows.filter((r) => r.narration_status);
    const audioReady = rows.filter((r) => r.narration_status === "ready").length;
    const audioTotal = withNarration.length || pois.length;

    const body: RouteStatusResponse = {
      routeId: route.id,
      origin: route.origin,
      destination: route.destination,
      intervalKm: route.interval_km,
      pois,
      audioReady,
      audioTotal,
      ready: audioTotal === 0 || audioReady >= audioTotal,
    };
    return c.json(body);
  });

  app.get("/audio/*", async (c) => {
    const key = decodeURIComponent(c.req.path.replace(/^\/audio\//, ""));
    if (!key) {
      return c.json({ error: "Missing audio key" }, 400);
    }

    const store = new R2AudioStore(c.env.AUDIO);
    const body = await store.get(key);
    if (!body) {
      return c.json({ error: "Audio not found" }, 404);
    }

    return new Response(body, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  });

  return app;
}
