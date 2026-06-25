import { PermissionsAndroid, Platform } from 'react-native';

let watchId = null;

export async function requestLocationPermission() {
  if (Platform.OS === 'android') {
    const fine = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      {
        title: 'Location Permission',
        message: 'Device Tracker needs access to your precise location.',
        buttonPositive: 'Grant',
      }
    );
    if (fine !== PermissionsAndroid.RESULTS.GRANTED) return false;

    if (Platform.Version >= 29) {
      const bg = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_BACKGROUND_LOCATION,
        {
          title: 'Background Location',
          message: 'Allow location access even when the app is closed?',
          buttonPositive: 'Allow',
          buttonNegative: 'Skip',
        }
      );
    }
    return true;
  }
  return true;
}

export function startTracking(onLocation, intervalMs = 10000) {
  const Geolocation = require('@react-native-community/geolocation').default;

  watchId = Geolocation.watchPosition(
    (pos) => {
      const { latitude, longitude, accuracy, speed, heading, altitude } = pos.coords;
      onLocation({ latitude, longitude, accuracy, speed, heading, altitude });
    },
    (error) => console.warn('Location error:', error.message),
    {
      enableHighAccuracy: true,
      distanceFilter: 10,
      interval: intervalMs,
      fastestInterval: 5000,
    }
  );
}

export function stopTracking() {
  if (watchId != null) {
    const Geolocation = require('@react-native-community/geolocation').default;
    Geolocation.clearWatch(watchId);
    watchId = null;
  }
}
