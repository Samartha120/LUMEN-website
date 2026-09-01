import { VoiceService } from '../src/services/voice.service';

describe('VoiceService Tests', () => {
  test('parses electrical hazard speech accurately', () => {
    const text = 'Danger! Exposed wire sparking near the electrical transformer on 100ft road!';
    const parsed = VoiceService.parseSpeechTranscript(text);

    expect(parsed.inferredCategory).toBe('electrical');
    expect(parsed.inferredSeverity).toBe('CRITICAL');
    expect(parsed.extractedKeywords.length).toBeGreaterThan(0);
    expect(parsed.extractedKeywords.some(k => k.isUrgencyTrigger)).toBe(true);
  });

  test('parses water and drainage leak speech', () => {
    const text = 'Severe waterlogging and open manhole near the metro station.';
    const parsed = VoiceService.parseSpeechTranscript(text);

    expect(parsed.inferredCategory).toBe('water');
    expect(parsed.inferredDamageClass).toBe('open_manhole');
    expect(parsed.inferredSeverity).toBe('CRITICAL');
  });

  test('parses road pothole speech with landmark', () => {
    const text = 'Deep pothole on road near Holy Cross School.';
    const parsed = VoiceService.parseSpeechTranscript(text);

    expect(parsed.inferredCategory).toBe('roads');
    expect(parsed.inferredDamageClass).toBe('pothole');
    expect(parsed.detectedLandmark).toBeDefined();
  });

  test('generates waveform metering array for UI', () => {
    const wave = VoiceService.generateWaveformSamples(32);
    expect(wave.length).toBe(32);
    wave.forEach(val => {
      expect(val).toBeGreaterThanOrEqual(0);
      expect(val).toBeLessThanOrEqual(1);
    });
  });
});
