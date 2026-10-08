import type { DrivingCommand } from "@/services/driving/DrivingCommand";
import type { NarrationEvent } from "@/services/narration/NarrationQueue";
import type { Location, PointOfInterest } from "@/types";
import * as FileSystem from "expo-file-system/legacy";
import { Share } from "react-native";

const ROOT = `${FileSystem.documentDirectory}trips/`;

export type TripLogEvent =
  | { type: "session_start"; at: string; routeId?: string }
  | { type: "session_end"; at: string }
  | { type: "position"; at: string; location: Location }
  | { type: "trigger"; at: string; poiId: string; name: string }
  | { type: "command"; at: string; command: DrivingCommand }
  | (NarrationEvent & { at: string })
  | { type: "api_error"; at: string; message: string };

export class TripLog {
  private path: string | null = null;
  private positionCounter = 0;

  get currentPath(): string | null {
    return this.path;
  }

  async start(routeId?: string): Promise<string> {
    await FileSystem.makeDirectoryAsync(ROOT, { intermediates: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    this.path = `${ROOT}${stamp}.jsonl`;
    this.positionCounter = 0;
    await this.append({
      type: "session_start",
      at: new Date().toISOString(),
      routeId,
    });
    return this.path;
  }

  async end(): Promise<void> {
    if (!this.path) return;
    await this.append({
      type: "session_end",
      at: new Date().toISOString(),
    });
  }

  async logPosition(location: Location): Promise<void> {
    this.positionCounter += 1;
    if (this.positionCounter % 5 !== 1) return;
    await this.append({
      type: "position",
      at: new Date().toISOString(),
      location,
    });
  }

  async logTrigger(poi: PointOfInterest): Promise<void> {
    await this.append({
      type: "trigger",
      at: new Date().toISOString(),
      poiId: poi.id,
      name: poi.name,
    });
  }

  async logNarration(event: NarrationEvent): Promise<void> {
    await this.append({ ...event, at: new Date().toISOString() });
  }

  async logCommand(command: DrivingCommand): Promise<void> {
    await this.append({
      type: "command",
      at: new Date().toISOString(),
      command,
    });
  }

  async logApiError(message: string): Promise<void> {
    await this.append({
      type: "api_error",
      at: new Date().toISOString(),
      message,
    });
  }

  async shareLatest(): Promise<void> {
    const path = this.path ?? (await this.findLatest());
    if (!path) {
      throw new Error("Ingen tripplogg hittades");
    }
    const body = await FileSystem.readAsStringAsync(path);
    await Share.share({
      url: path,
      message: body,
      title: "Trip log",
    });
  }

  private async findLatest(): Promise<string | null> {
    const info = await FileSystem.getInfoAsync(ROOT);
    if (!info.exists) return null;
    const entries = await FileSystem.readDirectoryAsync(ROOT);
    const logs = entries.filter((name) => name.endsWith(".jsonl")).sort();
    if (logs.length === 0) return null;
    return `${ROOT}${logs[logs.length - 1]}`;
  }

  private async append(event: TripLogEvent): Promise<void> {
    if (!this.path) return;
    const existing = await FileSystem.readAsStringAsync(this.path).catch(
      () => ""
    );
    await FileSystem.writeAsStringAsync(
      this.path,
      `${existing}${JSON.stringify(event)}\n`
    );
  }
}

export const tripLog = new TripLog();
