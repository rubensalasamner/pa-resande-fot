import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { Location as LocationType } from '@/types';

const LOCATION_TASK_NAME = 'background-location-task';

export class LocationService {
  private locationSubscription: Location.LocationSubscription | null = null;
  private onLocationUpdate?: (location: LocationType) => void;
  private backgroundTaskStarted: boolean = false;

  async requestPermissions(): Promise<boolean> {
    const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();
    if (foregroundStatus !== 'granted') {
      return false;
    }

    // Try to request background permission, but don't fail if not available (Expo Go limitation)
    try {
      const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
      if (backgroundStatus !== 'granted') {
        console.warn('Background location permission not granted - foreground tracking will still work');
      }
    } catch (error) {
      // Background location not available in Expo Go - this is expected
      console.warn('Background location not available (Expo Go limitation):', error);
    }

    return true;
  }

  async startLocationTracking(onUpdate: (location: LocationType) => void) {
    this.onLocationUpdate = onUpdate;

    // Start foreground location tracking (this works in Expo Go)
    this.locationSubscription = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.Balanced,
        timeInterval: 5000, // Update every 5 seconds
        distanceInterval: 50, // Or every 50 meters
      },
      (location) => {
        const locationData: LocationType = {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          accuracy: location.coords.accuracy,
          timestamp: location.timestamp,
        };
        this.onLocationUpdate?.(locationData);
      }
    );

    // Try to register background task (may not work in Expo Go)
    // This is optional - foreground tracking will work fine
    try {
      const isTaskDefined = TaskManager.isTaskDefined(LOCATION_TASK_NAME);
      if (isTaskDefined) {
        await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
          accuracy: Location.Accuracy.Balanced,
          timeInterval: 10000, // 10 seconds in background
          distanceInterval: 100, // 100 meters in background
          foregroundService: {
            notificationTitle: 'Travel Guide Active',
            notificationBody: 'Tracking your journey',
          },
        });
        this.backgroundTaskStarted = true;
      }
    } catch (error) {
      // Background location not available in Expo Go - this is expected and OK
      // Foreground tracking will still work
      this.backgroundTaskStarted = false;
    }
  }

  async stopLocationTracking() {
    // Stop foreground tracking
    if (this.locationSubscription) {
      this.locationSubscription.remove();
      this.locationSubscription = null;
    }

    // Only try to stop background task if we actually started it
    if (this.backgroundTaskStarted) {
      try {
        const isTaskDefined = TaskManager.isTaskDefined(LOCATION_TASK_NAME);
        if (isTaskDefined) {
          const isRegistered = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
          if (isRegistered) {
            await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
          }
        }
      } catch (error) {
        // Silently ignore - task may not have been registered (Expo Go limitation)
      }
      this.backgroundTaskStarted = false;
    }
  }
}

// Define background task handler
TaskManager.defineTask(LOCATION_TASK_NAME, ({ data, error }) => {
  if (error) {
    console.error('Location task error:', error);
    return;
  }
  if (data) {
    const { locations } = data as any;
    // Handle background location updates
    // You can emit events or update store here
    console.log('Background location update:', locations);
  }
});

