import Constants from 'expo-constants';
import { Platform } from 'react-native';

/**
 * Environment configuration — points to production online backend api.foodie.kwiko.org.
 * On Web in dev mode, routes through Metro proxy to bypass browser CORS preflight blocks.
 */
type Extra = {
  apiBaseUrl?: string;
  wsUrl?: string;
};

const extra = (Constants.expoConfig?.extra ?? {}) as Extra;

let apiBaseUrl = 'http://api.foodie.kwiko.org';


export const ENV = {
  apiBaseUrl,
  wsUrl: 'ws://api.foodie.kwiko.org/ws',
  appName: 'foodie-restaurant',
  appVersion: Constants.expoConfig?.version ?? '0.1.0',
} as const;
