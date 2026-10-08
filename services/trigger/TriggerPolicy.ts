export interface TriggerPolicy {
  shouldTrigger(poiId: string): boolean;
  markTriggered(poiId: string): void;
  reset(): void;
}

/** Each POI narrates at most once until reset (new drive / new route). */
export class OncePerSessionPolicy implements TriggerPolicy {
  private triggered = new Set<string>();

  shouldTrigger(poiId: string): boolean {
    return !this.triggered.has(poiId);
  }

  markTriggered(poiId: string): void {
    this.triggered.add(poiId);
  }

  reset(): void {
    this.triggered.clear();
  }
}

/** Re-allows a POI after `cooldownMs` (useful for the simulator). */
export class CooldownPolicy implements TriggerPolicy {
  private lastTriggered = new Map<string, number>();

  constructor(private readonly cooldownMs: number) {}

  shouldTrigger(poiId: string): boolean {
    const last = this.lastTriggered.get(poiId);
    if (last == null) return true;
    return Date.now() - last > this.cooldownMs;
  }

  markTriggered(poiId: string): void {
    this.lastTriggered.set(poiId, Date.now());
  }

  reset(): void {
    this.lastTriggered.clear();
  }
}
