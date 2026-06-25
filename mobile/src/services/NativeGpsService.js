import { NativeModules, NativeEventEmitter, Platform } from 'react-native';

const isAndroid = Platform.OS === 'android';
let emitter = null;
let listener = null;
let onLocationCallback = null;

if (isAndroid) {
  const NativeGps = NativeModules.NativeGps;
  if (NativeGps) {
    emitter = new NativeEventEmitter(NativeGps);
  }
}

export function startNativeGps(onLocation) {
  if (!isAndroid || !NativeModules.NativeGps) return false;
  onLocationCallback = onLocation;
  listener = emitter.addListener('onGpsLocation', (loc) => {
    if (onLocationCallback) onLocationCallback(loc);
  });
  NativeModules.NativeGps.start();
  return true;
}

export function stopNativeGps() {
  if (!isAndroid || !NativeModules.NativeGps) return;
  NativeModules.NativeGps.stop();
  if (listener) listener.remove();
  listener = null;
  onLocationCallback = null;
}
