import { apiClient } from "@/services/ApiClient";
import type { ActiveRoute, PointOfInterest } from "@/types";
import * as FileSystem from "expo-file-system/legacy";

const ROOT = `${FileSystem.documentDirectory}routes/`;

export interface PackProgress {
  phase: "waiting-audio" | "downloading" | "done";
  audioReady: number;
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

    while (!status.ready && attempts < 120) {
      onProgress?.({
        phase: "waiting-audio",
        audioReady: status.audioReady,
        audioTotal: status.audioTotal,
        downloaded: 0,
      });
      await sleep(2000);
      status = await apiClient.getRoute(routeId);
      attempts += 1;
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
            audioReady: status.audioReady,
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

    onProgress?.({
      phase: "done",
      audioReady: status.audioReady,
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
}

export const routePackStore = new RoutePackStore();
