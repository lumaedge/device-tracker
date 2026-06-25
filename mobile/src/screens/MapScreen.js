import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { api } from '../api';
import AsyncStorage from '@react-native-async-storage/async-storage';

const TRACK_URL = 'https://device-tracker-production-c455.up.railway.app/track.html';

export default function MapScreen({ user, onLogout }) {
  const [deviceName, setDeviceName] = useState('');
  const [uri, setUri] = useState(null);
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
      const token = await AsyncStorage.getItem('token');
      setUri(`${TRACK_URL}?device_id=${encodeURIComponent(id)}&token=${encodeURIComponent(token)}`);
    })();
  }, [user]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Device Tracker</Text>
        <TouchableOpacity onPress={onLogout}>
          <Text style={styles.logout}>Logout</Text>
        </TouchableOpacity>
      </View>

      {uri ? (
        <WebView
          ref={webViewRef}
          source={{ uri }}
          style={styles.map}
          originWhitelist={['*']}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          geolocationEnabled={true}
        />
      ) : (
        <View style={styles.loading}>
          <Text style={{ color: '#888' }}>Initializing...</Text>
        </View>
      )}

      {deviceName && (
        <View style={styles.footer}>
          <Text style={styles.footerText}>Device: {deviceName}</Text>
        </View>
      )}
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
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  footer: {
    padding: 12, backgroundColor: '#16213e', borderTopWidth: 1, borderTopColor: '#0f3460',
  },
  footerText: { color: '#888', fontSize: 13, textAlign: 'center' },
});
