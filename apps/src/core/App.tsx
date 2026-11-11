import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import {
  ErrorBoundaryFallback,
  captureCrashException,
} from 'foodie-shared-rn';
import { Platform, StyleSheet, View } from 'react-native';
import { RootNavigator } from '../navigation/RootNavigator';
import { BootstrapGate } from './bootstrap/BootstrapGate';
import { ConnectivityBanner } from './components/ConnectivityBanner';
import { PushRegistrationBridge } from './push/PushRegistrationBridge';
import { NavigationProvider } from './providers/NavigationProvider';
import { ReduxProvider } from './providers/ReduxProvider';
import { ThemeProvider } from './providers/ThemeProvider';
import { useAppStateChange } from 'foodie-shared-rn';
import { useAppDispatch } from '../store/hooks';
import { baseApi } from '../api/baseApi';

function ForegroundSyncBridge() {
  const dispatch = useAppDispatch();
  useAppStateChange((next, previous) => {
    if (previous?.match(/inactive|background/) && next === 'active') {
      try {
        dispatch(baseApi.util.invalidateTags(['Order', 'RestaurantMenu']));
      } catch {}
    }
  });
  return null;
}

type BoundaryState = { hasError: boolean; error?: Error };

class RootErrorBoundary extends Component<
  { children: ReactNode },
  BoundaryState
> {
  override state: BoundaryState = { hasError: false };

  static getDerivedStateFromError(error: Error): BoundaryState {
    return { hasError: true, error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    captureCrashException(error, { screenName: 'RootErrorBoundary' });
    console.error('RootErrorBoundary caught error:', error, info.componentStack);
  }

  override render(): ReactNode {
    if (this.state.hasError) {
      return (
        <ErrorBoundaryFallback
          variant="root"
          description={
            this.state.error?.message
              ? ('Error: ' + this.state.error.message)
              : 'Please try again. If the problem continues, restart the app.'
          }
          onAction={() => this.setState({ hasError: false, error: undefined })}
        />
      );
    }
    return this.props.children;
  }
}

/**
 * Root composition — Blueprint §2.1.
 * Providers only + navigation; no business screens.
 */
export default function App() {
  return (
    <ReduxProvider>
      <ThemeProvider>
        <RootErrorBoundary>
          <NavigationProvider>
            <BootstrapGate>
              <View style={styles.shell}>
                <ConnectivityBanner />
                <PushRegistrationBridge />
                <ForegroundSyncBridge />
                <View style={styles.content}>
                  <RootNavigator />
                </View>
              </View>
            </BootstrapGate>
          </NavigationProvider>
        </RootErrorBoundary>
      </ThemeProvider>
    </ReduxProvider>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
    height: Platform.OS === 'web' ? ('100vh' as any) : '100%',
  },
  content: {
    flex: 1,
    height: Platform.OS === 'web' ? ('100vh' as any) : '100%',
  },
});
