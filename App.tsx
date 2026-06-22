// Root app component. Gates navigation on auth state, hydrates the auth
// store from AsyncStorage on cold start, and wires the offline queue's
// auto-flush (services/offlineQueue.ts) for the app's lifetime.

import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'react-native';
import { useAuthStore } from './src/store/authStore';
import { startQueueAutoFlush } from './src/services/offlineQueue';
import { RootNavigator } from './src/navigation/RootNavigator';
import { LoginScreen } from './src/screens/LoginScreen';
import { colors } from './src/theme/tokens';

export default function App() {
  const { isAuthenticated, hydrate } = useAuthStore();
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    void hydrate().then(() => setIsHydrated(true));
    const unsubscribe = startQueueAutoFlush();
    return unsubscribe;
  }, [hydrate]);

  if (!isHydrated) return null;

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" backgroundColor={colors.white} />
      <NavigationContainer>
        {isAuthenticated ? <RootNavigator /> : <LoginScreen />}
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
