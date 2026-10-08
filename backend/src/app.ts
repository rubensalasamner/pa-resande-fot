import { Hono } from "hono";
import { cors } from "hono/cors";
import type {
  PoisListResponse,
  PrepareRouteRequest,
  PrepareRouteResponse,
} from "../../shared/apiTypes";
import { readRouteConfig } from "./config";
import { createPlanDeps } from "./createDeps";
import { planRoute } from "./domain/planRoute";
import { getRouteStatus } from "./domain/routeStatus";
import type { Env } from "./env";
import { queryPoisNear, toPoiDto, type PoiRow } from "./poiMapper";
import { R2AudioStore } from "./providers/R2AudioStore";

type AppEnv = { Bindings: Env };

function requestOrigin(c: { req: { url: string } }): string {
  return new URL(c.req.url).origin;
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

    const { voiceId } = readRouteConfig(c.env);
    const rows = await queryPoisNear(c.env.DB, lat, lon, radius, voiceId);
    const origin = requestOrigin(c);
    const pois = rows.map((row) => toPoiDto(row, origin));

    const body: PoisListResponse = { success: true, pois };
    return c.json(body);
  });

  app.get("/api/all-pois", async (c) => {
    const { voiceId } = readRouteConfig(c.env);
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

    try {
      const result = await planRoute(createPlanDeps(c.env), {
        origin: body.origin.trim(),
        destination: body.destination.trim(),
        intervalKm,
      });

      const response: PrepareRouteResponse = {
        routeId: result.routeId,
        message: `Rutt på ${Math.round(result.distanceM / 1000)} km skapad. Söker platser längs vägen.`,
        distanceM: result.distanceM,
        collectJobs: result.jobCount,
      };
      return c.json(response);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("prepare-route failed:", message);
      return c.json({ error: "prepare-route failed", message }, 500);
    }
  });

  app.get("/api/routes/:id", async (c) => {
    const status = await getRouteStatus(
      c.env.DB,
      c.req.param("id"),
      readRouteConfig(c.env).voiceId,
      requestOrigin(c)
    );
    if (!status) {
      return c.json({ error: "Route not found" }, 404);
    }
    return c.json(status);
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
