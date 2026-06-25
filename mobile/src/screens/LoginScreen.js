import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { api, setToken } from '../api';

export default function LoginScreen({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [isRegister, setIsRegister] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    if (!email || !password) return;
    setLoading(true);
    try {
      const endpoint = isRegister ? '/api/auth/register' : '/api/auth/login';
      const body = isRegister ? { email, password, name } : { email, password };
      const data = await api('POST', endpoint, body);
      setToken(data.token);
      onLogin(data.user);
    } catch {
      Alert.alert('Error', isRegister ? 'Registration failed' : 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={styles.box}>
        <Text style={styles.title}>Device Tracker</Text>
        <Text style={styles.subtitle}>{isRegister ? 'Create Account' : 'Sign In'}</Text>

        {isRegister && (
          <TextInput
            style={styles.input}
            placeholder="Name"
            placeholderTextColor="#666"
            value={name}
            onChangeText={setName}
          />
        )}
        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor="#666"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor="#666"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <TouchableOpacity style={styles.button} onPress={handleSubmit} disabled={loading}>
          <Text style={styles.buttonText}>{loading ? '...' : isRegister ? 'Register' : 'Login'}</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => setIsRegister(!isRegister)}>
          <Text style={styles.switchText}>
            {isRegister ? 'Already have an account? Login' : "Don't have an account? Register"}
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1a1a2e', justifyContent: 'center', padding: 24 },
  box: { backgroundColor: '#16213e', borderRadius: 12, padding: 32, borderWidth: 1, borderColor: '#0f3460' },
  title: { fontSize: 28, fontWeight: '700', color: '#e94560', textAlign: 'center', marginBottom: 8 },
  subtitle: { fontSize: 16, color: '#888', textAlign: 'center', marginBottom: 24 },
  input: {
    backgroundColor: '#0f3460', borderRadius: 8, padding: 14, fontSize: 16,
    color: '#e0e0e0', marginBottom: 12, borderWidth: 1, borderColor: '#1a5276',
  },
  button: {
    backgroundColor: '#e94560', borderRadius: 8, padding: 16, alignItems: 'center', marginTop: 8,
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  switchText: { color: '#4fc3f7', textAlign: 'center', marginTop: 16, fontSize: 14 },
});
