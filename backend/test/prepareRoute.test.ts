import { describe, expect, it, vi } from "vitest";
import { prepareRoute, type PrepareRouteDeps } from "../src/domain/prepareRoute";
import type {
  AudioStore,
  PoiSource,
  RouteProvider,
  ScriptWriter,
  TtsProvider,
} from "../src/providers/types";

function createFakeDb() {
  const pois = new Map<string, any>();
  const narrations = new Map<string, any>();
  const routes = new Map<string, any>();
  const routePois: any[] = [];

  const api = {
    prepare(sql: string) {
      return {
        bind(...args: unknown[]) {
          return {
            async run() {
              if (sql.includes("INSERT INTO routes")) {
                routes.set(String(args[0]), args);
              } else if (sql.includes("INSERT INTO pois")) {
                pois.set(String(args[0]), {
                  id: args[0],
                  name: args[1],
                  fact: args[5],
                });
              } else if (sql.includes("INSERT INTO route_pois")) {
                routePois.push(args);
              } else if (sql.includes("INSERT INTO narrations")) {
                const key = `${args[0]}|${args[1]}|${args[2]}`;
                narrations.set(key, { status: "pending" });
              } else if (sql.includes("UPDATE narrations") && sql.includes("'ready'")) {
                const key = `${args[2]}|${args[3]}|${args[4]}`;
                narrations.set(key, { status: "ready", r2_key: args[0] });
              }
              return { success: true };
            },
            async first() {
              if (sql.includes("SELECT status FROM narrations")) {
                const key = `${args[0]}|${args[1]}|${args[2]}`;
                return narrations.get(key) ?? null;
              }
              if (sql.includes("SELECT status, r2_key FROM narrations")) {
                const key = `${args[0]}|${args[1]}|${args[2]}`;
                return narrations.get(key) ?? null;
              }
              return null;
            },
          };
        },
      };
    },
  };

  return { db: api as unknown as D1Database, pois, narrations, routes, routePois };
}

describe("prepareRoute", () => {
  it("dedupes POIs and enqueues only missing audio", async () => {
    const fake = createFakeDb();
    const sendBatch = vi.fn(async () => undefined);

    const routeProvider: RouteProvider = {
      async geocode(q) {
        return q.includes("Mora")
          ? { lat: 61.0, lon: 14.5 }
          : { lat: 59.3, lon: 18.0 };
      },
      async getDrivingRoute() {
        return {
          coordinates: [
            [18.0, 59.3],
            [16.0, 60.0],
            [14.5, 61.0],
          ],
          distanceM: 300000,
        };
      },
    };

    const poiSource: PoiSource = {
      async findNear() {
        return [
          {
            id: "wiki:sv:1",
            name: "Plats A",
            latitude: 59.4,
            longitude: 17.5,
            fact: "En plats. Mer text.",
            category: "wikipedia",
          },
          {
            id: "wiki:sv:1",
            name: "Plats A",
            latitude: 59.4,
            longitude: 17.5,
            fact: "En plats. Mer text.",
          },
        ];
      },
    };

    const scriptWriter: ScriptWriter = {
      write(raw) {
        return raw;
      },
    };

    const audioStore: AudioStore = {
      keyFor: (v, p, h) => `${v}/${p}/${h}.mp3`,
      async put() {},
      async get() {
        return null;
      },
    };

    const deps: PrepareRouteDeps = {
      db: fake.db,
      routeProvider,
      poiSource,
      scriptWriter,
      audioStore,
      queue: { sendBatch, send: vi.fn() } as unknown as Queue,
      voiceId: "sv-SE-Chirp3-HD-Kore",
      defaultRadiusM: 500,
      inlineTtsMax: 5,
    };

    const result = await prepareRoute(deps, {
      origin: "Stockholm",
      destination: "Mora",
      intervalKm: 100,
    });

    expect(result.articlesSaved).toBe(1);
    expect(result.audioPending).toBe(1);
    expect(sendBatch).toHaveBeenCalledOnce();
    expect(fake.pois.size).toBe(1);
  });

  it("runs inline TTS when queue is missing", async () => {
    const fake = createFakeDb();
    const tts: TtsProvider = {
      async synthesize() {
        return Uint8Array.from([1, 2, 3]).buffer as ArrayBuffer;
      },
    };
    const put = vi.fn(async () => undefined);

    const deps: PrepareRouteDeps = {
      db: fake.db,
      routeProvider: {
        async geocode() {
          return { lat: 59.3, lon: 18.0 };
        },
        async getDrivingRoute() {
          return {
            coordinates: [
              [18.0, 59.3],
              [18.1, 59.4],
            ],
            distanceM: 10000,
          };
        },
      },
      poiSource: {
        async findNear() {
          return [
            {
              id: "wiki:sv:2",
              name: "B",
              latitude: 59.35,
              longitude: 18.05,
              fact: "Fakta.",
            },
          ];
        },
      },
      scriptWriter: { write: (r) => r },
      audioStore: {
        keyFor: () => "key.mp3",
        put,
        async get() {
          return null;
        },
      },
      tts,
      voiceId: "voice",
      defaultRadiusM: 500,
      inlineTtsMax: 5,
    };

    const result = await prepareRoute(deps, {
      origin: "A",
      destination: "B",
      intervalKm: 10,
    });

    expect(result.audioPending).toBe(0);
    expect(put).toHaveBeenCalled();
  });
});
