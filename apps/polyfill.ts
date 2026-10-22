// Polyfill TextDecoder for Hermes (Hermes only supports UTF-8 natively; libraries like jsPDF request 'latin1')
try {
  const g = (typeof globalThis !== 'undefined'
    ? globalThis
    : typeof global !== 'undefined'
    ? global
    : typeof window !== 'undefined'
    ? window
    : {}) as any;

  const NativeTextDecoder = g.TextDecoder;

  class PolyfilledTextDecoder {
    encoding: string;
    fatal: boolean;
    ignoreBOM: boolean;
    private nativeDecoder: any;

    constructor(label = 'utf-8', options?: { fatal?: boolean; ignoreBOM?: boolean }) {
      const normalized = String(label || 'utf-8').toLowerCase().replace(/[^a-z0-9]/g, '');
      this.fatal = !!options?.fatal;
      this.ignoreBOM = !!options?.ignoreBOM;

      if (!normalized || ['utf8', 'unicode11utf8', 'utf16le', 'utf16be'].includes(normalized)) {
        this.encoding = 'utf-8';
        if (typeof NativeTextDecoder === 'function') {
          try {
            this.nativeDecoder = new NativeTextDecoder(label, options);
          } catch {
            this.encoding = 'latin1';
          }
        }
      } else {
        this.encoding = normalized;
      }
    }

    decode(input?: ArrayBufferView | ArrayBuffer | null, options?: { stream?: boolean }): string {
      if (!input) return '';
      if (this.encoding !== 'utf-8' || !this.nativeDecoder) {
        const u8 =
          input instanceof Uint8Array
            ? input
            : new Uint8Array(ArrayBuffer.isView(input) ? input.buffer : input);
        let str = '';
        const chunkSize = 8192;
        for (let i = 0; i < u8.length; i += chunkSize) {
          str += String.fromCharCode.apply(
            null,
            u8.subarray(i, i + chunkSize) as unknown as number[]
          );
        }
        return str;
      }
      try {
        return this.nativeDecoder.decode(input, options);
      } catch {
        const u8 =
          input instanceof Uint8Array
            ? input
            : new Uint8Array(ArrayBuffer.isView(input) ? input.buffer : input);
        let str = '';
        for (let i = 0; i < u8.length; i += 8192) {
          str += String.fromCharCode.apply(null, u8.subarray(i, i + 8192) as unknown as number[]);
        }
        return str;
      }
    }
  }

  const targets = [
    typeof globalThis !== 'undefined' ? globalThis : null,
    typeof global !== 'undefined' ? global : null,
    typeof window !== 'undefined' ? window : null,
    typeof self !== 'undefined' ? self : null,
  ].filter(Boolean);

  for (const t of targets) {
    try {
      Object.defineProperty(t, 'TextDecoder', {
        value: PolyfilledTextDecoder,
        writable: true,
        configurable: true,
        enumerable: true,
      });
    } catch {
      try {
        (t as any).TextDecoder = PolyfilledTextDecoder;
      } catch {}
    }
  }
} catch (e) {
  // Ignore
}

// Polyfill React Native feature flags for Expo Go VirtualizedList compatibility
try {
    const g = globalThis as any;
    if (!g.ReactNativeFeatureFlags) {
        g.ReactNativeFeatureFlags = {};
    }
    if (typeof g.ReactNativeFeatureFlags.enableOptimisedVirtualizedCells !== 'function') {
        g.ReactNativeFeatureFlags.enableOptimisedVirtualizedCells = () => false;
    }
} catch {
    // Ignore
}

try {
    const featureFlags = require('react-native/Libraries/ReactNative/ReactNativeFeatureFlags');
    if (featureFlags) {
        if (typeof featureFlags.enableOptimisedVirtualizedCells !== 'function') featureFlags.enableOptimisedVirtualizedCells = () => false;
        if (featureFlags.default && typeof featureFlags.default.enableOptimisedVirtualizedCells !== 'function') featureFlags.default.enableOptimisedVirtualizedCells = () => false;
    }
} catch (e) { }



if (typeof document !== 'undefined') {
    const style = document.createElement('style');
    style.id = 'expo-reset';
    style.textContent = `
      html, body, #root {
        height: 100%;
        width: 100%;
        display: flex;
        flex-direction: column;
        margin: 0;
        padding: 0;
      }
    `;
    if (!document.getElementById('expo-reset')) {
        document.head.appendChild(style);
    }
}
