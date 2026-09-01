/**
 * User telemetry, screen performance, and error diagnostics service.
 */

import { StorageService } from './storage.service';

export interface TelemetryEvent {
  id: string;
  name: string;
  category: 'NAVIGATION' | 'ACTION' | 'PERFORMANCE' | 'ERROR' | 'AI_INFERENCE';
  payload?: Record<string, any>;
  timestamp: string;
}

const TELEMETRY_CACHE_KEY = 'telemetry_event_log';

export class TelemetryService {
  private static events: TelemetryEvent[] = [];

  /**
   * Log an event
   */
  static logEvent(name: string, category: TelemetryEvent['category'], payload?: Record<string, any>): void {
    const event: TelemetryEvent = {
      id: `ev-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      name,
      category,
      payload,
      timestamp: new Date().toISOString(),
    };

    this.events.push(event);
    if (this.events.length > 100) {
      this.events.shift();
    }

    // Debounced background storage
    this.persistEvents();
  }

  /**
   * Measure function execution duration
   */
  static async measureDuration<T>(metricName: string, fn: () => Promise<T>): Promise<T> {
    const start = Date.now();
    try {
      const result = await fn();
      const durationMs = Date.now() - start;
      this.logEvent(metricName, 'PERFORMANCE', { durationMs, status: 'SUCCESS' });
      return result;
    } catch (err: any) {
      const durationMs = Date.now() - start;
      this.logEvent(metricName, 'ERROR', { durationMs, error: err?.message });
      throw err;
    }
  }

  private static async persistEvents(): Promise<void> {
    try {
      await StorageService.setItem(TELEMETRY_CACHE_KEY, this.events);
    } catch {
      // ignore telemetry store error
    }
  }

  /**
   * Get all captured events
   */
  static async getEvents(): Promise<TelemetryEvent[]> {
    const cached = await StorageService.getItem<TelemetryEvent[]>(TELEMETRY_CACHE_KEY);
    return cached || this.events;
  }
}
