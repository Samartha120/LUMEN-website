import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { theme } from '../../theme';
import { Icon } from '../../Icon';
import { VoiceService } from '../../services/voice.service';
import { HapticFeedback } from '../../utils/haptics';

export interface AudioRecorderProps {
  onRecordingComplete: (audioUri: string, durationSeconds: number, waveform: number[]) => void;
  maxDurationSeconds?: number;
}

export const AudioRecorder: React.FC<AudioRecorderProps> = ({
  onRecordingComplete,
  maxDurationSeconds = 60,
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [durationSeconds, setDurationSeconds] = useState(0);
  const [waveform, setWaveform] = useState<number[]>([]);
  const [pulseAnim] = useState(new Animated.Value(1));

  useEffect(() => {
    let interval: any = null;
    let waveInterval: any = null;

    if (isRecording) {
      // Pulse animation for record ring
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.2, duration: 600, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        ])
      ).start();

      interval = setInterval(() => {
        setDurationSeconds(d => {
          if (d + 1 >= maxDurationSeconds) {
            stopRecording();
            return maxDurationSeconds;
          }
          return d + 1;
        });
      }, 1000);

      waveInterval = setInterval(() => {
        setWaveform(VoiceService.generateWaveformSamples(28));
      }, 250);
    } else {
      pulseAnim.setValue(1);
      if (interval) clearInterval(interval);
      if (waveInterval) clearInterval(waveInterval);
    }

    return () => {
      if (interval) clearInterval(interval);
      if (waveInterval) clearInterval(waveInterval);
    };
  }, [isRecording]);

  const startRecording = () => {
    HapticFeedback.medium();
    setDurationSeconds(0);
    setWaveform(VoiceService.generateWaveformSamples(28));
    setIsRecording(true);
  };

  const stopRecording = () => {
    HapticFeedback.success();
    setIsRecording(false);
    onRecordingComplete('file://dummy-voice-note.m4a', Math.max(1, durationSeconds), waveform);
  };

  const formatTimer = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Voice Memo Reporting</Text>
      <Text style={styles.subtitle}>
        {isRecording
          ? 'Listening... Speak clearly about location, hazard type, and severity'
          : 'Tap the microphone to record a quick audio description'}
      </Text>

      {/* Waveform visualizer */}
      <View style={styles.waveformContainer}>
        {waveform.length > 0 ? (
          waveform.map((amp, idx) => (
            <View
              key={idx}
              style={[
                styles.waveBar,
                {
                  height: Math.max(6, amp * 48),
                  backgroundColor: isRecording ? theme.colors.primary : theme.colors.border,
                },
              ]}
            />
          ))
        ) : (
          <View style={styles.placeholderWave}>
            <Text style={styles.placeholderText}>Audio visualizer ready</Text>
          </View>
        )}
      </View>

      {/* Timer display */}
      <Text style={[styles.timerText, isRecording && styles.timerTextActive]}>
        {formatTimer(durationSeconds)} / {formatTimer(maxDurationSeconds)}
      </Text>

      {/* Record button */}
      <View style={styles.buttonWrapper}>
        {isRecording && (
          <Animated.View
            style={[
              styles.pulseRing,
              {
                transform: [{ scale: pulseAnim }],
              },
            ]}
          />
        )}
        <TouchableOpacity
          style={[styles.recordBtn, isRecording && styles.recordBtnActive]}
          onPress={isRecording ? stopRecording : startRecording}
          activeOpacity={0.8}
        >
          <Icon
            name={isRecording ? 'stop' : 'mic'}
            size={28}
            color={theme.colors.card}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  title: {
    fontSize: theme.typography.sizes.lg,
    fontWeight: '700',
    color: theme.colors.text,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textMuted,
    textAlign: 'center',
    marginBottom: theme.spacing.md,
  },
  waveformContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 56,
    width: '100%',
    backgroundColor: theme.colors.background,
    borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.sm,
    gap: 3,
    marginBottom: theme.spacing.md,
  },
  waveBar: {
    width: 4,
    borderRadius: 2,
  },
  placeholderWave: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholderText: {
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
  },
  timerText: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: '600',
    color: theme.colors.textMuted,
    marginBottom: theme.spacing.md,
  },
  timerTextActive: {
    color: theme.colors.danger,
    fontWeight: '700',
  },
  buttonWrapper: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    width: 72,
    height: 72,
  },
  pulseRing: {
    position: 'absolute',
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(239, 68, 68, 0.25)',
  },
  recordBtn: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  recordBtnActive: {
    backgroundColor: theme.colors.danger,
  },
});
