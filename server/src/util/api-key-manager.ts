/**
 * API Key Manager Service
 * 
 * Manages multiple comma-separated API keys with rotation logic
 * to distribute load and handle rate limiting across multiple keys.
 */

import { createHash } from "node:crypto";
import type { ApiKeyMetadata } from "@sv/services/tracking/apiCallTracker.types.js";

export interface ApiKeyConfig {
  keys: string[];
  currentIndex: number;
  lastUsedTimestamp: Map<string, number>;
}

class ApiKeyManager {
  private keyConfigs: Map<string, ApiKeyConfig> = new Map();

  /**
   * Parse comma-separated API keys from environment variable
   * @param envValue - Comma-separated string of API keys
   * @returns Array of API keys
   */
  private parseKeys(envValue: string | undefined): string[] {
    if (!envValue) {
      return [];
    }

    return envValue
      .split(',')
      .map(key => key.trim())
      .filter(key => key.length > 0);
  }

  /**
   * Initialize API keys for a specific service
   * @param serviceName - Name of the service (e.g., 'birdeye', 'moralis')
   * @param envValue - Comma-separated API keys from environment
   */
  public initializeKeys(serviceName: string, envValue: string | undefined): void {
    const keys = this.parseKeys(envValue);

    if (keys.length === 0) {
      console.warn(`No API keys found for ${serviceName}`);
      return;
    }

    this.keyConfigs.set(serviceName, {
      keys,
      currentIndex: 0,
      lastUsedTimestamp: new Map(),
    });

    console.log(`Initialized ${keys.length} API key(s) for ${serviceName}`);
  }

  /**
   * Get the next API key using round-robin rotation
   * @param serviceName - Name of the service
   * @returns Next API key in rotation
   */
  public getNextKey(serviceName: string): string | null {
    const config = this.keyConfigs.get(serviceName);

    if (!config || config.keys.length === 0) {
      console.error(`No API keys configured for ${serviceName}`);
      return null;
    }

    const key = config.keys[config.currentIndex];
    config.lastUsedTimestamp.set(key, Date.now());

    // Move to next key for round-robin
    config.currentIndex = (config.currentIndex + 1) % config.keys.length;

    return key;
  }

  /**
   * Get a specific key by index
   * @param serviceName - Name of the service
   * @param index - Index of the key to retrieve
   * @returns API key at the specified index
   */
  public getKeyByIndex(serviceName: string, index: number): string | null {
    const config = this.keyConfigs.get(serviceName);

    if (!config || config.keys.length === 0) {
      return null;
    }

    if (index < 0 || index >= config.keys.length) {
      return null;
    }

    const key = config.keys[index];
    // Track usage time
    config.lastUsedTimestamp.set(key, Date.now());

    return key;
  }

  /**
   * Get all keys for a service
   * @param serviceName - Name of the service
   * @returns Array of all API keys
   */
  public getAllKeys(serviceName: string): string[] {
    const config = this.keyConfigs.get(serviceName);
    return config ? [...config.keys] : [];
  }

  /**
   * Get the least recently used key
   * @param serviceName - Name of the service
   * @returns Least recently used API key
   */
  public getLeastRecentlyUsedKey(serviceName: string): string | null {
    const config = this.keyConfigs.get(serviceName);

    if (!config || config.keys.length === 0) {
      return null;
    }

    let lruKey = config.keys[0];
    let lruTimestamp = config.lastUsedTimestamp.get(lruKey) || 0;

    for (const key of config.keys) {
      const timestamp = config.lastUsedTimestamp.get(key) || 0;
      if (timestamp < lruTimestamp) {
        lruKey = key;
        lruTimestamp = timestamp;
      }
    }

    config.lastUsedTimestamp.set(lruKey, Date.now());
    return lruKey;
  }

  /**
   * Get the total number of keys for a service
   * @param serviceName - Name of the service
   * @returns Number of API keys
   */
  public getKeyCount(serviceName: string): number {
    const config = this.keyConfigs.get(serviceName);
    return config ? config.keys.length : 0;
  }

  /**
   * Mark a key as failed (for future implementation of key health tracking)
   * @param serviceName - Name of the service
   * @param key - The API key that failed
   */
  public markKeyAsFailed(serviceName: string, key: string): void {
    // Future implementation: Track failed keys and implement health checking
    console.warn(`API key failed for ${serviceName}: ${key.substring(0, 8)}...`);
  }
}

function maskApiKey(key: string): string {
  if (key.length <= 8) {
    return `${key.slice(0, 2)}***${key.slice(-2)}`;
  }

  return `${key.slice(0, 4)}...${key.slice(-4)}`;
}

function fingerprintApiKey(key: string): string {
  return createHash("sha256").update(key).digest("hex").slice(0, 16);
}

export function buildApiKeyMetadata(
  key: string | null,
  source: string,
): ApiKeyMetadata | null {
  if (!key) {
    return null;
  }

  return {
    source,
    masked: maskApiKey(key),
    fingerprint: fingerprintApiKey(key),
  };
}

// Export singleton instance
export const apiKeyManager = new ApiKeyManager();
