import type { UnwrappedApiError } from 'foodie-shared-rn';

/** Normalize RTK Query unwrap failures to UnwrappedApiError with descriptive fallback. */
export function toUnwrappedApiError(err: unknown): UnwrappedApiError {
  if (err && typeof err === 'object') {
    const withData = err as {
      data?: any;
      status?: unknown;
      error?: string;
      message?: string;
      code?: string;
    };

    const statusNum = typeof withData.status === 'number' ? withData.status : undefined;

    const innerData = withData.data;
    const errorBody = innerData?.error || innerData;

    if (errorBody && typeof errorBody === 'object') {
      const code = errorBody.code || innerData?.code;
      const message = errorBody.message || innerData?.message;
      if (code || message) {
        return {
          code: String(code || 'ERROR'),
          message: String(message || 'An API error occurred.'),
          fields: errorBody.fields ?? null,
          status: statusNum,
        };
      }
    }

    const direct = err as UnwrappedApiError;
    if (direct.code && direct.message) {
      return {
        ...direct,
        status: direct.status ?? statusNum,
      };
    }

    if (typeof withData.error === 'string' && withData.error.trim().length > 0) {
      return {
        code: 'NETWORK_ERROR',
        message: withData.error,
        fields: null,
        status: statusNum,
      };
    }

    if (statusNum !== undefined) {
      return {
        code: 'HTTP_ERROR',
        message: `Request failed with status ${statusNum}`,
        fields: null,
        status: statusNum,
      };
    }
  }

  return {
    code: 'INTERNAL_ERROR',
    message: err instanceof Error ? err.message : 'Unable to complete request. Check connection.',
    fields: null,
  };
}
