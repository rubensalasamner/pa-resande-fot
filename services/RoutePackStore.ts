import { apiClient } from "@/services/ApiClient";
import type { ActiveRoute, PointOfInterest } from "@/types";
import * as FileSystem from "expo-file-system/legacy";

const ROOT = `${FileSystem.documentDirectory}routes/`;
const ACTIVE_ID_PATH = `${FileSystem.documentDirectory}active-route-id.txt`;

export interface PackProgress {
  phase: "collecting" | "waiting-audio" | "downloading" | "done";
  collectJobsDone: number;
  collectJobsTotal: number;
  audioReady: number;
  audioFailed: number;
  audioTotal: number;
  downloaded: number;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class RoutePackStore {
  async waitAndDownload(
    routeId: string,
    onProgress?: (p: PackProgress) => void
  ): Promise<ActiveRoute> {
    let status = await apiClient.getRoute(routeId);
    let attempts = 0;

    while (
      status.status !== "ready" &&
      status.status !== "failed" &&
      attempts < 180
    ) {
      onProgress?.({
        phase: status.status === "collecting" ? "collecting" : "waiting-audio",
        collectJobsDone: status.collectJobsDone,
        collectJobsTotal: status.collectJobsTotal,
        audioReady: status.audioReady,
        audioFailed: status.audioFailed,
        audioTotal: status.audioTotal,
        downloaded: 0,
      });
      await sleep(2000);
      status = await apiClient.getRoute(routeId);
      attempts += 1;
    }

    if (status.status === "failed") {
      throw new Error(status.error || "Ruttförberedelsen misslyckades");
    }

    const dir = `${ROOT}${routeId}/`;
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });

    const pois: PointOfInterest[] = [];
    let downloaded = 0;

    for (const poi of status.pois) {
      let localAudioPath: string | undefined;
      if (poi.audioUrl) {
        const safeId = poi.id.replace(/[^a-zA-Z0-9_-]/g, "_");
        const path = `${dir}${safeId}.mp3`;
        try {
          const result = await FileSystem.downloadAsync(poi.audioUrl, path);
          localAudioPath = result.uri;
          downloaded += 1;
          onProgress?.({
            phase: "downloading",
            collectJobsDone: status.collectJobsDone,
            collectJobsTotal: status.collectJobsTotal,
            audioReady: status.audioReady,
            audioFailed: status.audioFailed,
            audioTotal: status.audioTotal,
            downloaded,
          });
        } catch (error) {
          console.warn("Failed to download audio for", poi.id, error);
        }
      }

      pois.push({
        id: poi.id,
        name: poi.name,
        latitude: poi.latitude,
        longitude: poi.longitude,
        radius: poi.radius,
        fact: poi.fact,
        category: poi.category,
        audioUrl: poi.audioUrl,
        localAudioPath,
      });
    }

    const active: ActiveRoute = {
      routeId,
      origin: status.origin,
      destination: status.destination,
      pois,
    };

    await FileSystem.writeAsStringAsync(
      `${dir}manifest.json`,
      JSON.stringify(active)
    );
    await this.setActiveRouteId(routeId);

    onProgress?.({
      phase: "done",
      collectJobsDone: status.collectJobsDone,
      collectJobsTotal: status.collectJobsTotal,
      audioReady: status.audioReady,
      audioFailed: status.audioFailed,
      audioTotal: status.audioTotal,
      downloaded,
    });

    return active;
  }

  async loadManifest(routeId: string): Promise<ActiveRoute | null> {
    const path = `${ROOT}${routeId}/manifest.json`;
    const info = await FileSystem.getInfoAsync(path);
    if (!info.exists) return null;
    const raw = await FileSystem.readAsStringAsync(path);
    return JSON.parse(raw) as ActiveRoute;
  }

  async setActiveRouteId(routeId: string): Promise<void> {
    await FileSystem.writeAsStringAsync(ACTIVE_ID_PATH, routeId);
  }

  async getActiveRouteId(): Promise<string | null> {
    const info = await FileSystem.getInfoAsync(ACTIVE_ID_PATH);
    if (!info.exists) return null;
    const id = (await FileSystem.readAsStringAsync(ACTIVE_ID_PATH)).trim();
    return id || null;
  }

  async restoreActiveRoute(): Promise<ActiveRoute | null> {
    const routeId = await this.getActiveRouteId();
    if (!routeId) return null;
    return this.loadManifest(routeId);
  }

  async clearActiveRoute(): Promise<void> {
    const routeId = await this.getActiveRouteId();
    const info = await FileSystem.getInfoAsync(ACTIVE_ID_PATH);
    if (info.exists) {
      await FileSystem.deleteAsync(ACTIVE_ID_PATH, { idempotent: true });
    }
    if (routeId) {
      await FileSystem.deleteAsync(`${ROOT}${routeId}/`, { idempotent: true });
    }
  }
}

export const routePackStore = new RoutePackStore();
