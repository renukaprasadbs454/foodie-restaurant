import React, { useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, View } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { useConnectivity } from 'foodie-shared-rn';
import { useAppDispatch } from '../../store/hooks';
import { setConnectivity } from '../../store/connectivitySlice';
import { runBootstrap } from './bootstrap';

SplashScreen.preventAutoHideAsync().catch(() => {});

export function BootstrapGate({ children }: { children: ReactNode }) {
  const dispatch = useAppDispatch();
  const [ready, setReady] = useState(false);
  const connectivity = useConnectivity();

  useEffect(() => {
    dispatch(
      setConnectivity({
        isConnected: connectivity.isConnected,
        isInternetReachable: connectivity.isInternetReachable,
      }),
    );
  }, [
    connectivity.isConnected,
    connectivity.isInternetReachable,
    dispatch,
  ]);

  useEffect(() => {
    let mounted = true;
    void (async () => {
      try {
        await runBootstrap(dispatch);
      } finally {
        if (mounted) {
          setReady(true);
          await SplashScreen.hideAsync().catch(() => {});
        }
      }
    })();
    return () => {
      mounted = false;
    };
  }, [dispatch]);

  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFFFF' }}>
        <ActivityIndicator size="large" color="#14532D" />
      </View>
    );
  }

  return <>{children}</>;
}
