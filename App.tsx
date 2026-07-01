import React, { Component, useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  StatusBar,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuthStore } from './src/store/authStore';
import { startQueueAutoFlush } from './src/services/offlineQueue';
import { RootNavigator } from './src/navigation/RootNavigator';
import { LoginScreen } from './src/screens/LoginScreen';
import { WelcomeScreen } from './src/screens/WelcomeScreen';
import { colors, spacing, typography } from './src/theme/tokens';

const WELCOME_KEY = 'wellness:welcome_seen';

class ErrorBoundary extends Component<
  { children: React.ReactNode },
  { crashed: boolean }
> {
  state = { crashed: false };
  static getDerivedStateFromError() {
    return { crashed: true };
  }
  componentDidCatch(error: unknown) {
    console.error('[ErrorBoundary]', error);
  }
  render() {
    if (!this.state.crashed) {
      return this.props.children;
    }
    return (
      <View style={eb.screen}>
        <Text style={eb.title}>Something went wrong</Text>
        <Text style={eb.body}>
          The app encountered an unexpected error. Please restart it.
        </Text>
        <TouchableOpacity
          style={eb.btn}
          onPress={() => this.setState({ crashed: false })}
        >
          <Text style={eb.btnText}>Try again</Text>
        </TouchableOpacity>
      </View>
    );
  }
}

const eb = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.screenBg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  title: {
    ...typography.h2,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  body: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing.xl,
  },
  btn: {
    backgroundColor: colors.primaryTeal,
    borderRadius: 99,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  btnText: {
    ...typography.body,
    color: colors.white,
    fontWeight: '700' as const,
  },
});

export default function App() {
  const { isAuthenticated, hydrate } = useAuthStore();
  const [isHydrated, setIsHydrated] = useState(false);
  // undefined = not yet read; true = seen before; false = first launch
  const [welcomeSeen, setWelcomeSeen] = useState<boolean | undefined>(
    undefined,
  );
  const [showApp, setShowApp] = useState(false);

  useEffect(() => {
    const init = async () => {
      const [, seen] = await Promise.all([
        hydrate(),
        AsyncStorage.getItem(WELCOME_KEY),
      ]);
      setWelcomeSeen(seen === 'yes');
      setIsHydrated(true);
    };
    void init();
    const unsubscribe = startQueueAutoFlush();
    return unsubscribe;
  }, [hydrate]);

  const handleWelcomeContinue = async () => {
    await AsyncStorage.setItem(WELCOME_KEY, 'yes').catch(() => {});
    setShowApp(true);
  };

  // Show WelcomeScreen until the user has explicitly continued
  // (or auto-skips for returning users after the loader finishes)
  if (!showApp) {
    return (
      <ErrorBoundary>
        <SafeAreaProvider>
          <StatusBar barStyle="light-content" backgroundColor="#0F1C16" />
          <WelcomeScreen
            hydrated={isHydrated}
            firstLaunch={welcomeSeen === false}
            onContinue={handleWelcomeContinue}
          />
        </SafeAreaProvider>
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <StatusBar barStyle="light-content" backgroundColor={colors.toroInk} />
        <NavigationContainer>
          {isAuthenticated ? <RootNavigator /> : <LoginScreen />}
        </NavigationContainer>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}
