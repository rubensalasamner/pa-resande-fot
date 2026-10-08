import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_VOICE_ID, type RouteConfig } from "../src/config";
import {
  collectRoutePois,
  failCollectJob,
} from "../src/domain/collectRoutePois";
import { failRoute, finalizeRoute } from "../src/domain/finalizeRoute";
import {
  markNarrationFailed,
  processNarrationJob,
} from "../src/domain/narrationJob";
import { planRoute } from "../src/domain/planRoute";
import { getRouteStatus } from "../src/domain/routeStatus";
import type {
  AudioStore,
  PoiSource,
  RouteProvider,
  ScriptWriter,
  TtsProvider,
} from "../src/providers/types";
import type {
  CollectJobMessage,
  RouteJobMessage,
  TtsJobMessage,
} from "../src/queue/messages";
import { createTestDb, type TestDb } from "./helpers/d1";
import { createFakeQueue } from "./helpers/fakeQueue";

const config: RouteConfig = {
  voiceId: DEFAULT_VOICE_ID,
  defaultRadiusM: 500,
  maxDistanceFromRouteM: 1500,
  triggerMarginM: 300,
  samplesPerCollectJob: 2,
};

const scriptWriter: ScriptWriter = { write: (fact) => fact };

function stubRoute(distanceKm = 30): RouteProvider {
  const endLat = 59.0 + (distanceKm * 1000) / 111_195;
  return {
    async geocode(q) {
      return q.includes("Mora")
        ? { lat: endLat, lon: 18.0 }
        : { lat: 59.0, lon: 18.0 };
    },
    async getDrivingRoute() {
      const steps = Math.max(Math.ceil(distanceKm), 2);
      return {
        coordinates: Array.from({ length: steps + 1 }, (_, i) => [
          18.0,
          59.0 + (i / steps) * (endLat - 59.0),
        ]),
        distanceM: distanceKm * 1000,
      };
    },
  };
}

function stubPois(entries: Array<{ id: string; latOffsetKm: number; lonOffsetM?: number }>): PoiSource {
  return {
    async findNear(point) {
      return entries
        .filter((entry) => {
          const lat = 59.0 + (entry.latOffsetKm * 1000) / 111_195;
          return Math.abs(lat - point.lat) < 0.03;
        })
        .map((entry) => {
          const lonOffset =
            (entry.lonOffsetM ?? 0) /
            (111_320 * Math.cos((point.lat * Math.PI) / 180));
          return {
            id: entry.id,
            name: entry.id,
            latitude: 59.0 + (entry.latOffsetKm * 1000) / 111_195,
            longitude: 18.0 + lonOffset,
            fact: `Fakta om ${entry.id}.`,
            category: "wikipedia",
          };
        });
    },
  };
}

function memoryAudioStore(): AudioStore & { blobs: Map<string, ArrayBuffer> } {
  const blobs = new Map<string, ArrayBuffer>();
  return {
    blobs,
    keyFor: (v, p, h) => `${v}/${p}/${h}.mp3`,
    async put(key, data) {
      blobs.set(key, data);
    },
    async get() {
      return null;
    },
  };
}

async function drainCollect(
  db: D1Database,
  routeQueue: ReturnType<typeof createFakeQueue<RouteJobMessage>>,
  poiSource: PoiSource
): Promise<void> {
  const jobs = routeQueue.drain().filter(
    (job): job is CollectJobMessage => job.kind === "collect"
  );
  for (const job of jobs) {
    await collectRoutePois(
      {
        db,
        poiSource,
        scriptWriter,
        routeQueue: routeQueue.queue,
        config,
      },
      job
    );
  }
}

describe("route pipeline", () => {
  let testDb: TestDb;

  beforeAll(async () => {
    testDb = await createTestDb();
  }, 60_000);

  afterAll(async () => {
    await testDb.dispose();
  });

  beforeEach(async () => {
    await testDb.reset();
  });

  it("plans, collects, finalizes and synthesizes a short route", async () => {
    const { db } = testDb;
    const routeQueue = createFakeQueue<RouteJobMessage>();
    const ttsQueue = createFakeQueue<TtsJobMessage>();
    const audioStore = memoryAudioStore();
    const tts: TtsProvider = {
      async synthesize() {
        return Uint8Array.from([1, 2, 3]).buffer as ArrayBuffer;
      },
    };

    const planned = await planRoute(
      {
        db,
        routeProvider: stubRoute(20),
        routeQueue: routeQueue.queue,
        config,
      },
      { origin: "Stockholm", destination: "Mora", intervalKm: 10 }
    );

    expect(planned.jobCount).toBeGreaterThan(0);
    expect(routeQueue.sent.every((j) => j.kind === "collect")).toBe(true);

    await drainCollect(
      db,
      routeQueue,
      stubPois([
        { id: "wiki:a", latOffsetKm: 2 },
        { id: "wiki:b", latOffsetKm: 12 },
        { id: "wiki:far", latOffsetKm: 5, lonOffsetM: 3000 },
      ])
    );

    const finalizeMsg = routeQueue.drain().find((j) => j.kind === "finalize");
    expect(finalizeMsg).toEqual({ kind: "finalize", routeId: planned.routeId });

    await finalizeRoute(
      { db, ttsQueue: ttsQueue.queue },
      planned.routeId,
      config.voiceId
    );

    const statusMid = await getRouteStatus(
      db,
      planned.routeId,
      config.voiceId,
      "http://test"
    );
    expect(statusMid?.status).toBe("generating");
    expect(statusMid?.pois.every((p) => p.id !== "wiki:far")).toBe(true);
    expect(ttsQueue.sent.length).toBe(statusMid?.audioTotal);

    for (const job of ttsQueue.drain()) {
      await processNarrationJob({ db, tts, audioStore }, job);
    }

    const status = await getRouteStatus(
      db,
      planned.routeId,
      config.voiceId,
      "http://test"
    );
    expect(status?.status).toBe("ready");
    expect(status?.audioReady).toBe(status?.audioTotal);
    expect(status?.audioFailed).toBe(0);
    expect(audioStore.blobs.size).toBe(status?.audioTotal);
  });

  it("picks the closest POI per interval window", async () => {
    const { db } = testDb;
    const routeQueue = createFakeQueue<RouteJobMessage>();
    const ttsQueue = createFakeQueue<TtsJobMessage>();

    const planned = await planRoute(
      {
        db,
        routeProvider: stubRoute(15),
        routeQueue: routeQueue.queue,
        config,
      },
      { origin: "A", destination: "B", intervalKm: 10 }
    );

    await drainCollect(
      db,
      routeQueue,
      stubPois([
        { id: "near", latOffsetKm: 3, lonOffsetM: 100 },
        { id: "farther", latOffsetKm: 3.2, lonOffsetM: 800 },
      ])
    );
    routeQueue.drain();

    await finalizeRoute(
      { db, ttsQueue: ttsQueue.queue },
      planned.routeId,
      config.voiceId
    );

    const status = await getRouteStatus(
      db,
      planned.routeId,
      config.voiceId,
      "http://test"
    );
    expect(status?.pois.map((p) => p.id)).toEqual(["near"]);
  });

  it("marks a route ready when some narrations fail", async () => {
    const { db } = testDb;
    const routeQueue = createFakeQueue<RouteJobMessage>();
    const ttsQueue = createFakeQueue<TtsJobMessage>();
    const audioStore = memoryAudioStore();

    const planned = await planRoute(
      {
        db,
        routeProvider: stubRoute(20),
        routeQueue: routeQueue.queue,
        config,
      },
      { origin: "A", destination: "B", intervalKm: 10 }
    );

    await drainCollect(
      db,
      routeQueue,
      stubPois([
        { id: "ok", latOffsetKm: 2 },
        { id: "bad", latOffsetKm: 12 },
      ])
    );
    routeQueue.drain();
    await finalizeRoute(
      { db, ttsQueue: ttsQueue.queue },
      planned.routeId,
      config.voiceId
    );

    for (const job of ttsQueue.drain()) {
      if (job.poiId === "bad") {
        await markNarrationFailed(db, job, new Error("tts down"));
      } else {
        await processNarrationJob(
          {
            db,
            tts: {
              async synthesize() {
                return Uint8Array.from([9]).buffer as ArrayBuffer;
              },
            },
            audioStore,
          },
          job
        );
      }
    }

    const status = await getRouteStatus(
      db,
      planned.routeId,
      config.voiceId,
      "http://test"
    );
    expect(status?.status).toBe("ready");
    expect(status?.audioFailed).toBe(1);
    expect(status?.audioReady).toBe(1);
  });

  it("still finalizes after a collect job is given up", async () => {
    const { db } = testDb;
    const routeQueue = createFakeQueue<RouteJobMessage>();
    const ttsQueue = createFakeQueue<TtsJobMessage>();

    const planned = await planRoute(
      {
        db,
        routeProvider: stubRoute(20),
        routeQueue: routeQueue.queue,
        config: { ...config, samplesPerCollectJob: 1 },
      },
      { origin: "A", destination: "B", intervalKm: 10 }
    );

    const collectJobs = routeQueue
      .drain()
      .filter((j): j is CollectJobMessage => j.kind === "collect");
    expect(collectJobs.length).toBeGreaterThan(1);

    const [first, ...rest] = collectJobs;
    await failCollectJob(
      { db, routeQueue: routeQueue.queue },
      first,
      new Error("wiki down")
    );

    for (const job of rest) {
      await collectRoutePois(
        {
          db,
          poiSource: stubPois([{ id: "ok", latOffsetKm: 12 }]),
          scriptWriter,
          routeQueue: routeQueue.queue,
          config,
        },
        job
      );
    }

    const finalizeMsg = routeQueue.drain().find((j) => j.kind === "finalize");
    expect(finalizeMsg?.kind).toBe("finalize");

    await finalizeRoute(
      { db, ttsQueue: ttsQueue.queue },
      planned.routeId,
      config.voiceId
    );

    const status = await getRouteStatus(
      db,
      planned.routeId,
      config.voiceId,
      "http://test"
    );
    expect(status?.status).toBe("generating");
    expect(status?.collectJobsFailed).toBe(1);
  });

  it("records a failed route when finalize gives up", async () => {
    const { db } = testDb;
    await failRoute(db, "missing", new Error("nope"));

    const planned = await planRoute(
      {
        db,
        routeProvider: stubRoute(5),
        routeQueue: createFakeQueue<RouteJobMessage>().queue,
        config,
      },
      { origin: "A", destination: "B", intervalKm: 5 }
    );

    await failRoute(db, planned.routeId, new Error("finalize crashed"));
    const status = await getRouteStatus(
      db,
      planned.routeId,
      config.voiceId,
      "http://test"
    );
    expect(status?.status).toBe("failed");
    expect(status?.error).toContain("finalize crashed");
  });
});
