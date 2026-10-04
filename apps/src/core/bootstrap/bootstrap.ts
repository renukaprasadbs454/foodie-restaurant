import {
  clearRefreshToken,
  initAnalytics,
  initCrashReporting,
  loadRefreshToken,
  logger,
  noOpAnalyticsClient,
  noOpCrashReporter,
  performTokenRefresh,
  saveRefreshToken,
} from 'foodie-shared-rn';
import { ENV } from '../../constants/env';
import { baseApi } from '../../api/baseApi';
import {
  clearCredentials,
  setAuthStatus,
  setCredentials,
} from '../../features/auth/authSlice';
import type { AppDispatch } from '../../store/store';

/** TD-011: clear SecureStore + Redux + RTK on forced session end. */
async function terminateSession(dispatch: AppDispatch): Promise<void> {
  await clearRefreshToken();
  dispatch(clearCredentials());
  dispatch(baseApi.util.resetApiState());
}

/**
 * Cold-start sequence — Blueprint §2.1 bootstrap / §11.3.
 * Initializes crash/analytics, restores refresh token, refreshes session.
 * Does not implement login UI.
 */
export async function runBootstrap(dispatch: AppDispatch): Promise<void> {
  dispatch(setAuthStatus('authenticating'));

  try {
    await Promise.race([
      (async () => {
        await initCrashReporting(noOpCrashReporter, {
          appName: ENV.appName,
          appVersion: ENV.appVersion,
        }).catch(() => null);

        await initAnalytics(noOpAnalyticsClient, {
          appName: ENV.appName,
          appVersion: ENV.appVersion,
        }).catch(() => null);

        logger.info('Bootstrap started', { app: ENV.appName });

        const refreshToken = await loadRefreshToken().catch(() => null);
        if (!refreshToken) {
          await terminateSession(dispatch);
          logger.info('Bootstrap: no refresh token — unauthenticated');
          return;
        }

        const pair = await performTokenRefresh({
          baseUrl: ENV.apiBaseUrl,
          refreshToken,
          callbacks: {
            onCredentialsRefreshed: async (tokens, raw) => {
              await saveRefreshToken(tokens.refreshToken);
              dispatch(
                setCredentials({
                  accessToken: String(tokens.accessToken),
                  refreshToken: String(tokens.refreshToken),
                  userType: (raw?.userType as 'RESTAURANT') ?? 'RESTAURANT',
                  userId: raw?.userId ?? '',
                  isNewUser: raw?.isNewUser,
                }),
              );
            },
            onTokenReuseDetected: async () => {
              await terminateSession(dispatch);
            },
            onRefreshFailed: async () => {
              await terminateSession(dispatch);
            },
          },
        }).catch(() => null);

        if (!pair) {
          await terminateSession(dispatch);
        }
      })(),
      new Promise((resolve) => setTimeout(resolve, 3000)),
    ]);
  } catch (error) {
    logger.error('Bootstrap failed', {
      message: error instanceof Error ? error.message : 'unknown',
    });
  } finally {
    // Only terminate session if authentication was not successful
    const state = (dispatch as any).getState?.() || {};
    if (state.auth?.authStatus === 'authenticating' || state.auth?.authStatus === 'idle') {
      await terminateSession(dispatch);
    }
  }
}
