import Constants from 'expo-constants';
import { Platform } from 'react-native';

/**
 * Environment configuration — points to production online backend api.foodie.kwiko.org.
 */
type Extra = {
  apiBaseUrl?: string;
  wsUrl?: string;
};

const extra = (Constants.expoConfig?.extra ?? {}) as Extra;

let apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? process.env.EXPO_PUBLIC_API_BASE_URL ?? extra.apiBaseUrl ?? 'https://api.foodie.kwiko.org';
let wsUrl = process.env.EXPO_PUBLIC_WS_URL ?? extra.wsUrl ?? 'wss://api.foodie.kwiko.org/ws';

export const ENV = {
  apiBaseUrl,
  wsUrl,
  appName: 'foodie-restaurant',
  appVersion: Constants.expoConfig?.version ?? '0.1.0',
} as const;

if (__DEV__) {
  console.log('[Foodie Restaurant Env] Target API Base URL:', ENV.apiBaseUrl);
}
