import type { Location } from "@/types";

export function haversineMeters(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number }
): number {
  const R = 6371e3;
  const φ1 = (a.latitude * Math.PI) / 180;
  const φ2 = (b.latitude * Math.PI) / 180;
  const Δφ = ((b.latitude - a.latitude) * Math.PI) / 180;
  const Δλ = ((b.longitude - a.longitude) * Math.PI) / 180;
  const h =
    Math.sin(Δφ / 2) ** 2 +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export function createProximityFreshness(options: {
  getLocation: () => Location | null;
  maxAgeMs?: number;
  radiusMarginM?: number;
}) {
  const maxAgeMs = options.maxAgeMs ?? 90_000;
  const radiusMarginM = options.radiusMarginM ?? 500;

  return (
    poi: { latitude: number; longitude: number; radius: number },
    queuedAt: number
  ): boolean => {
    if (Date.now() - queuedAt > maxAgeMs) return false;
    const location = options.getLocation();
    if (!location) return true;
    const distance = haversineMeters(location, poi);
    return distance <= poi.radius + radiusMarginM;
  };
}
