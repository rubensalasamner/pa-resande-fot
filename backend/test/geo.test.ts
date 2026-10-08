import { describe, expect, it } from "vitest";
import {
  boundingBox,
  corridorSampling,
  decimateLineString,
  haversineMeters,
  nearestOnPath,
  samplePath,
  slicePath,
  type PathPoint,
} from "../src/domain/geo";

const NORTHBOUND: Array<[number, number]> = Array.from(
  { length: 201 },
  (_, i) => [18.0, 59.0 + i * 0.0005] as [number, number]
);

describe("haversineMeters", () => {
  it("returns ~0 for same point", () => {
    expect(
      haversineMeters({ lat: 59.33, lon: 18.07 }, { lat: 59.33, lon: 18.07 })
    ).toBeLessThan(1);
  });

  it("measures Stockholm to a nearby point roughly", () => {
    const d = haversineMeters(
      { lat: 59.3293, lon: 18.0686 },
      { lat: 59.34, lon: 18.07 }
    );
    expect(d).toBeGreaterThan(1000);
    expect(d).toBeLessThan(2000);
  });
});

describe("boundingBox", () => {
  it("expands around a point", () => {
    const box = boundingBox({ lat: 59.3, lon: 18.0 }, 1000);
    expect(box.minLat).toBeLessThan(59.3);
    expect(box.maxLat).toBeGreaterThan(59.3);
    expect(box.minLon).toBeLessThan(18.0);
    expect(box.maxLon).toBeGreaterThan(18.0);
  });
});

describe("decimateLineString", () => {
  it("keeps points at least minSpacing apart and preserves total length", () => {
    const path = decimateLineString(NORTHBOUND, 500);
    const total = haversineMeters(
      { lon: 18.0, lat: 59.0 },
      { lon: 18.0, lat: 59.1 }
    );

    expect(path[0][2]).toBe(0);
    expect(path[path.length - 1][2]).toBeCloseTo(total, -1);
    for (let i = 1; i < path.length - 1; i++) {
      expect(path[i][2] - path[i - 1][2]).toBeGreaterThanOrEqual(499);
    }
    expect(path.length).toBeLessThan(NORTHBOUND.length / 5);
  });

  it("returns an empty path for empty input", () => {
    expect(decimateLineString([], 100)).toEqual([]);
  });
});

describe("samplePath", () => {
  const path = decimateLineString(NORTHBOUND, 100);

  it("samples every spacing including start and end", () => {
    const samples = samplePath(path, 3000);
    expect(samples[0].alongM).toBe(0);
    expect(samples[1].alongM).toBe(3000);
    expect(samples[samples.length - 1].alongM).toBe(path[path.length - 1][2]);
  });

  it("interpolates positions on the path", () => {
    const [, second] = samplePath(path, 3000);
    expect(second.lon).toBeCloseTo(18.0, 5);
    expect(second.lat).toBeCloseTo(59.0 + 3000 / 111_195, 3);
  });

  it("rejects non-positive spacing", () => {
    expect(() => samplePath(path, 0)).toThrow();
  });
});

describe("slicePath", () => {
  const path: PathPoint[] = [
    [0, 0, 0],
    [0, 0.01, 1000],
    [0, 0.02, 2000],
    [0, 0.03, 3000],
    [0, 0.04, 4000],
  ];

  it("includes the bounding points around the range", () => {
    expect(slicePath(path, 1500, 2500).map((p) => p[2])).toEqual([
      1000, 2000, 3000,
    ]);
  });

  it("clamps to the path ends", () => {
    expect(slicePath(path, -500, 10_000)).toEqual(path);
  });
});

describe("nearestOnPath", () => {
  const path = decimateLineString(NORTHBOUND, 100);

  it("measures perpendicular distance and along-route position", () => {
    const lonOffset = 1000 / (111_320 * Math.cos((59.05 * Math.PI) / 180));
    const result = nearestOnPath(path, { lat: 59.05, lon: 18.0 + lonOffset });

    expect(result.distanceM).toBeCloseTo(1000, -1);
    expect(result.alongM).toBeCloseTo(haversineMeters(
      { lon: 18.0, lat: 59.0 },
      { lon: 18.0, lat: 59.05 }
    ), -1);
  });

  it("clamps to the path start for points before it", () => {
    const result = nearestOnPath(path, { lat: 58.99, lon: 18.0 });
    expect(result.alongM).toBe(0);
    expect(result.distanceM).toBeCloseTo(1113, -1);
  });
});

describe("corridorSampling", () => {
  it("covers the corridor half-width between samples", () => {
    const { spacingM, searchRadiusM } = corridorSampling(1500);
    const halfSpacing = spacingM / 2;
    expect(Math.hypot(halfSpacing, 1500)).toBeLessThanOrEqual(searchRadiusM);
  });

  it("caps the radius at the Wikipedia maximum", () => {
    expect(corridorSampling(9000).searchRadiusM).toBe(10_000);
  });
});
