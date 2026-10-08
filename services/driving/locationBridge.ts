import type { Location } from "@/types";

type LocationHandler = (location: Location) => void;

let handler: LocationHandler | null = null;

/** Register the single consumer of GPS updates (foreground + background). */
export function setLocationHandler(next: LocationHandler | null): void {
  handler = next;
}

export function emitLocation(location: Location): void {
  handler?.(location);
}
