import { describe, expect, it } from "vitest";
import { boundingBox, haversineMeters, sampleLineString } from "../src/domain/geo";

describe("haversineMeters", () => {
  it("returns ~0 for same point", () => {
    expect(haversineMeters({ lat: 59.33, lon: 18.07 }, { lat: 59.33, lon: 18.07 })).toBeLessThan(1);
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

describe("sampleLineString", () => {
  it("samples every interval including start", () => {
    // Roughly 0.09 deg lon ≈ 5 km at equator-ish; use short vertical segment in lat
    // 1 deg lat ≈ 111 km, so 0.045 deg ≈ 5 km
    const coords: Array<[number, number]> = [
      [18.0, 59.0],
      [18.0, 59.045],
      [18.0, 59.09],
    ];
    const samples = sampleLineString(coords, 5);
    expect(samples[0].distanceAlongM).toBe(0);
    expect(samples.length).toBeGreaterThanOrEqual(2);
    expect(samples.some((s) => Math.abs(s.distanceAlongM - 5000) < 200)).toBe(
      true
    );
  });

  it("rejects non-positive interval", () => {
    expect(() => sampleLineString([[0, 0], [1, 1]], 0)).toThrow();
  });
});
