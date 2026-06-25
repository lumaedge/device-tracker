import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList, Alert, Switch,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { api } from '../api';
import { requestLocationPermission, startTracking, stopTracking } from '../services/LocationService';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function MapScreen({ user, onLogout }) {
  const [devices, setDevices] = useState([]);
  const [geofences, setGeofences] = useState([]);
  const [tracking, setTracking] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [deviceName, setDeviceName] = useState('');
  const webViewRef = useRef(null);

  useEffect(() => {
    loadDevices();
    loadGeofences();
    loadDeviceId();
    const interval = setInterval(loadDevices, 15000);
    return () => { clearInterval(interval); stopTracking(); };
  }, []);

  async function loadDeviceId() {
    const id = await AsyncStorage.getItem('deviceId');
    if (id) setDeviceName(id);
  }

  async function loadDevices() {
    try {
      const data = await api('GET', '/api/devices');
      setDevices(data || []);
    } catch {}
  }

  async function loadGeofences() {
    try {
      const data = await api('GET', '/api/geofences');
      setGeofences(data || []);
    } catch {}
  }

  const sendToMap = useCallback((data) => {
    webViewRef.current?.postMessage(JSON.stringify(data));
  }, []);

  // Send data to WebView whenever it changes
  useEffect(() => {
    if (deviceName) {
      const myDevice = devices.find(d => d.id === deviceName);
      sendToMap({
        type: 'update',
        devices,
        geofences,
        myLocation: myDevice ? { latitude: myDevice.latitude, longitude: myDevice.longitude, battery: myDevice.battery } : null,
      });
    }
  }, [devices, geofences, deviceName]);

  const onLocationUpdate = useCallback(async (loc) => {
    let id = await AsyncStorage.getItem('deviceId');
    if (!id) {
      id = `${user.email}-${Date.now()}`;
      await AsyncStorage.setItem('deviceId', id);
      setDeviceName(id);
      await api('POST', '/api/devices', { id, name: `${user.name}'s Phone` });
    }
    await api('POST', '/api/locations', {
      device_id: id,
      ...loc,
    });
    // Send location to WebView immediately
    sendToMap({ type: 'update', devices, geofences, myLocation: loc });
  }, [user, devices, geofences, sendToMap]);

  async function toggleTracking() {
    if (tracking) {
      stopTracking();
      setTracking(false);
    } else {
      const ok = await requestLocationPermission();
      if (!ok) { Alert.alert('Permission denied'); return; }
      startTracking(onLocationUpdate, 15000);
      setTracking(true);
    }
  }

  const myDevice = devices.find(d => d.id === deviceName);
  const otherDevices = devices.filter(d => d.id !== deviceName);

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

        {myDevice && (
          <View style={styles.deviceInfo}>
            <Text style={styles.deviceName}>
              {myDevice.name} ({myDevice.battery?.toFixed(0) || '?'}%)
            </Text>
          </View>
        )}

        <FlatList
          data={otherDevices}
          keyExtractor={(d) => d.id}
          style={styles.deviceList}
          renderItem={({ item }) => (
            <View style={styles.deviceRow}>
              <View>
                <Text style={styles.deviceName}>{item.name}</Text>
                <Text style={styles.deviceMeta}>
                  {item.last_seen ? new Date(item.last_seen + 'Z').toLocaleString() : 'never'}
                </Text>
              </View>
              <Text style={styles.deviceBatt}>
                {item.battery != null ? `${item.battery.toFixed(0)}%` : ''}
              </Text>
            </View>
          )}
        />
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
    maxHeight: 250,
  },
  trackingRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 12,
  },
  trackingLabel: { color: '#e0e0e0', fontSize: 15 },
  deviceInfo: { marginBottom: 8 },
  deviceName: { color: '#e0e0e0', fontSize: 14, fontWeight: '600' },
  deviceMeta: { color: '#888', fontSize: 12 },
  deviceBatt: { color: '#4fc3f7', fontSize: 14, fontWeight: '600' },
  deviceList: { flexGrow: 0 },
  deviceRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#0f3460',
  },
});
