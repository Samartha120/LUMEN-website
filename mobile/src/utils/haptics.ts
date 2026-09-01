/**
 * Haptic feedback and vibration utility for interactive UI events.
 */

import { Vibration, Platform } from 'react-native';

export class HapticFeedback {
  /**
   * Subtle tap feedback for button presses & tabs
   */
  static light(): void {
    if (Platform.OS !== 'web') {
      Vibration.vibrate(10);
    }
  }

  /**
   * Medium feedback for confirmations and card selections
   */
  static medium(): void {
    if (Platform.OS !== 'web') {
      Vibration.vibrate(25);
    }
  }

  /**
   * Heavy feedback for critical emergency warnings and errors
   */
  static heavy(): void {
    if (Platform.OS !== 'web') {
      Vibration.vibrate([0, 50, 50, 100]);
    }
  }

  /**
   * Success sequence for verified submissions & badge unlocks
   */
  static success(): void {
    if (Platform.OS !== 'web') {
      Vibration.vibrate([0, 20, 80, 40]);
    }
  }
}
