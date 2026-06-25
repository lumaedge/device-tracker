import React, { useState, useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { loadToken, setToken } from './src/api';
import LoginScreen from './src/screens/LoginScreen';
import MapScreen from './src/screens/MapScreen';

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const token = await loadToken();
      if (token) {
        try {
          const { api } = require('./src/api');
          const u = await api('GET', '/api/auth/me');
          setUser(u);
        } catch {
          setToken(null);
        }
      }
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#1a1a2e', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#e94560" />
      </View>
    );
  }

  if (!user) return <LoginScreen onLogin={(u) => setUser(u)} />;

  return <MapScreen user={user} onLogout={() => { setToken(null); setUser(null); }} />;
}
