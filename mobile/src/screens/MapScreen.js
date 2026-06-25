import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Switch,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { api } from '../api';
import { startNativeGps, stopNativeGps } from '../services/NativeGpsService';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function MapScreen({ user, onLogout }) {
  const [tracking, setTracking] = useState(false);
  const [deviceName, setDeviceName] = useState('');
  const [ready, setReady] = useState(false);
  const webViewRef = useRef(null);

  useEffect(() => {
    (async () => {
      let id = await AsyncStorage.getItem('deviceId');
      if (!id) {
        id = `${user.email}-${Date.now()}`;
        await AsyncStorage.setItem('deviceId', id);
        await api('POST', '/api/devices', { id, name: `${user.name}'s Phone` });
      }
      setDeviceName(id);
      setReady(true);
    })();
  }, [user]);

  useEffect(() => {
    if (ready && deviceName && webViewRef.current) {
      AsyncStorage.getItem('token').then(t => {
        webViewRef.current.postMessage(JSON.stringify({
          type: 'init', deviceId: deviceName, token: t,
        }));
      });
    }
  }, [ready, deviceName]);

  const onLocation = useCallback(async (loc) => {
    const { latitude, longitude, accuracy, speed, altitude } = loc;
    webViewRef.current?.postMessage(JSON.stringify({
      type: 'myLocation', latitude, longitude, accuracy,
    }));
    await api('POST', '/api/locations', {
      device_id: deviceName,
      latitude, longitude, accuracy, speed, altitude,
    });
  }, [deviceName]);

  function toggleTracking() {
    if (tracking) {
      stopNativeGps();
      webViewRef.current?.postMessage(JSON.stringify({ type: 'stopTracking' }));
      setTracking(false);
    } else {
      const ok = startNativeGps(onLocation);
      if (!ok) return;
      webViewRef.current?.postMessage(JSON.stringify({ type: 'startTracking' }));
      setTracking(true);
    }
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Device Tracker</Text>
        <TouchableOpacity onPress={onLogout}>
          <Text style={styles.logout}>Logout</Text>
        </TouchableOpacity>
      </View>

      <WebView
        ref={webViewRef}
        source={{ uri: 'file:///android_asset/map.html' }}
        style={styles.map}
        originWhitelist={['*']}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        geolocationEnabled={true}
      />

      <View style={styles.controls}>
        <View style={styles.trackingRow}>
          <Text style={styles.trackingLabel}>Track this device</Text>
          <Switch
            value={tracking}
            onValueChange={toggleTracking}
            trackColor={{ false: '#333', true: '#e94560' }}
            thumbColor={tracking ? '#fff' : '#888'}
          />
        </View>

        {deviceName && (
          <View style={styles.deviceInfo}>
            <Text style={styles.deviceName}>Device: {deviceName}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a2e' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 16, paddingTop: 48, backgroundColor: '#16213e', borderBottomWidth: 1, borderBottomColor: '#0f3460',
  },
  title: { fontSize: 20, fontWeight: '700', color: '#e94560' },
  logout: { color: '#4fc3f7', fontSize: 14 },
  map: { flex: 1 },
  controls: {
    backgroundColor: '#16213e', padding: 16, borderTopWidth: 1, borderTopColor: '#0f3460',
  },
  trackingRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 12,
  },
  trackingLabel: { color: '#e0e0e0', fontSize: 15 },
  deviceInfo: { marginBottom: 8 },
  deviceName: { color: '#e0e0e0', fontSize: 14, fontWeight: '600' },
});
