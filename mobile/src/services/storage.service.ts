/**
 * Persistent and Encrypted Storage Service for LUMEN Mobile.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { CachedDataEntry } from '../types/offline.types';

const STORAGE_PREFIX = '@lumen_civic:';
const DEFAULT_CACHE_TTL = 1000 * 60 * 60 * 24; // 24 hours

export class StorageService {
  /**
   * Save item to general storage with TTL
   */
  static async setItem<T>(key: string, data: T, ttlMillis: number = DEFAULT_CACHE_TTL): Promise<void> {
    try {
      const entry: CachedDataEntry<T> = {
        key,
        data,
        savedAt: Date.now(),
        ttlMillis,
        version: 1,
      };
      await AsyncStorage.setItem(`${STORAGE_PREFIX}${key}`, JSON.stringify(entry));
    } catch (err) {
      console.warn(`[StorageService] Failed to setItem for key "${key}":`, err);
    }
  }

  /**
   * Retrieve item checking for TTL expiration
   */
  static async getItem<T>(key: string, returnExpiredIfOffline: boolean = true): Promise<T | null> {
    try {
      const raw = await AsyncStorage.getItem(`${STORAGE_PREFIX}${key}`);
      if (!raw) return null;

      const entry: CachedDataEntry<T> = JSON.parse(raw);
      const isExpired = Date.now() - entry.savedAt > entry.ttlMillis;

      if (isExpired && !returnExpiredIfOffline) {
        await AsyncStorage.removeItem(`${STORAGE_PREFIX}${key}`);
        return null;
      }

      return entry.data;
    } catch (err) {
      console.warn(`[StorageService] Failed to getItem for key "${key}":`, err);
      return null;
    }
  }

  /**
   * Remove item from general storage
   */
  static async removeItem(key: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(`${STORAGE_PREFIX}${key}`);
    } catch (err) {
      console.warn(`[StorageService] Failed to removeItem for key "${key}":`, err);
    }
  }

  /**
   * Secure Storage for sensitive auth tokens
   */
  static async setSecureToken(key: string, value: string): Promise<void> {
    try {
      await SecureStore.setItemAsync(`${STORAGE_PREFIX}${key}`, value);
    } catch (err) {
      // Fallback for web or non-secure environments
      await AsyncStorage.setItem(`SECURE_${STORAGE_PREFIX}${key}`, value);
    }
  }

  /**
   * Retrieve sensitive auth tokens
   */
  static async getSecureToken(key: string): Promise<string | null> {
    try {
      const val = await SecureStore.getItemAsync(`${STORAGE_PREFIX}${key}`);
      if (val) return val;
      return await AsyncStorage.getItem(`SECURE_${STORAGE_PREFIX}${key}`);
    } catch {
      return await AsyncStorage.getItem(`SECURE_${STORAGE_PREFIX}${key}`);
    }
  }

  /**
   * Clear all app-specific storage
   */
  static async clearAll(): Promise<void> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const lumenKeys = keys.filter(k => k.startsWith(STORAGE_PREFIX) || k.startsWith(`SECURE_${STORAGE_PREFIX}`));
      if (lumenKeys.length > 0) {
        await AsyncStorage.multiRemove(lumenKeys);
      }
    } catch (err) {
      console.warn('[StorageService] Failed to clearAll:', err);
    }
  }
}
