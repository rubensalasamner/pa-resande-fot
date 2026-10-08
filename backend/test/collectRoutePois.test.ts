import { describe, expect, it } from "vitest";
import { toCorridorPois } from "../src/domain/collectRoutePois";
import { decimateLineString } from "../src/domain/geo";
import type { RawPoi, ScriptWriter } from "../src/providers/types";

const path = decimateLineString(
  Array.from({ length: 101 }, (_, i) => [18.0, 59.0 + i * 0.001] as [number, number]),
  100
);

const writer: ScriptWriter = { write: (fact) => fact };

function poi(overrides: Partial<RawPoi> & Pick<RawPoi, "id" | "latitude">): RawPoi {
  return {
    name: overrides.id,
    longitude: 18.0,
    fact: "En plats.",
    ...overrides,
  };
}

describe("toCorridorPois", () => {
  const config = {
    maxDistanceFromRouteM: 1500,
    defaultRadiusM: 500,
    triggerMarginM: 300,
  };

  it("drops POIs beyond the corridor and dedupes by id", () => {
    const lonOffset = 2000 / (111_320 * Math.cos((59.05 * Math.PI) / 180));
    const result = toCorridorPois(
      [
        poi({ id: "near", latitude: 59.05 }),
        poi({ id: "near", latitude: 59.05 }),
        poi({ id: "far", latitude: 59.05, longitude: 18.0 + lonOffset }),
      ],
      path,
      writer,
      config
    );

    expect(result.map((p) => p.id)).toEqual(["near"]);
  });

  it("sets the trigger radius from distance plus margin", () => {
    const lonOffset = 800 / (111_320 * Math.cos((59.05 * Math.PI) / 180));
    const [result] = toCorridorPois(
      [poi({ id: "a", latitude: 59.05, longitude: 18.0 + lonOffset })],
      path,
      writer,
      config
    );

    expect(result.distanceM).toBeCloseTo(800, -1);
    expect(result.triggerRadiusM).toBe(Math.ceil(result.distanceM + 300));
  });

  it("never uses a trigger radius below the default", () => {
    const [result] = toCorridorPois(
      [poi({ id: "a", latitude: 59.05 })],
      path,
      writer,
      config
    );
    expect(result.triggerRadiusM).toBe(500);
  });
});
