/**
 * Minimal Buffer polyfill for browser compatibility
 * This is a stub implementation to prevent Vite warnings
 */

// Export a minimal Buffer-like object
export const Buffer = {
  from: (data: string | ArrayBuffer | Uint8Array) => {
    if (typeof data === 'string') {
      return new TextEncoder().encode(data);
    }
    if (data instanceof ArrayBuffer) {
      return new Uint8Array(data);
    }
    return data;
  },
  isBuffer: (obj: any) => obj instanceof Uint8Array,
};

// Make it available globally if needed
if (typeof window !== 'undefined') {
  (window as any).Buffer = Buffer;
}

