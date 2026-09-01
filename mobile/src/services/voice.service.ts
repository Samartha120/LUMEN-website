/**
 * Voice reporting and speech transcription service for LUMEN Mobile.
 */

import { ParsedVoiceReport, VoiceKeywordToken } from '../types/voice.types';
import { CivicCategory, CivicDamageClass } from '../types/civic.types';

const DAMAGE_CLASS_TRIGGERS: Array<{ cls: CivicDamageClass; triggers: string[] }> = [
  // Multi-word specific triggers first
  { cls: 'open_manhole', triggers: ['open manhole', 'manhole cover', 'drain cover open', 'missing manhole', 'manhole'] },
  { cls: 'waterlogging', triggers: ['waterlogging', 'standing water', 'water stagnation', 'flooded road'] },
  { cls: 'pipe_leak', triggers: ['pipe leak', 'pipeline leak', 'water burst', 'pipeline burst', 'burst pipe'] },
  { cls: 'exposed_wire', triggers: ['exposed wire', 'live wire', 'cable snap', 'snapped wire', 'sparking wire'] },
  { cls: 'open_transformer', triggers: ['open transformer', 'sparking transformer', 'transformer'] },
  { cls: 'damaged_pole', triggers: ['damaged pole', 'broken pole', 'bent pole', 'lamp post bent'] },
  { cls: 'broken_streetlight', triggers: ['broken streetlight', 'streetlight', 'street light dark', 'lamp off'] },
  { cls: 'garbage_pile', triggers: ['garbage pile', 'trash pile', 'waste dump', 'garbage dump'] },
  { cls: 'overflowing_bin', triggers: ['overflowing bin', 'bin full', 'dustbin overflow'] },
  { cls: 'debris', triggers: ['debris', 'rubble', 'construction waste', 'broken debris'] },
  { cls: 'broken_footpath', triggers: ['broken footpath', 'footpath damaged', 'broken sidewalk', 'pavement broken', 'footpath'] },
  { cls: 'damaged_signage', triggers: ['damaged signage', 'broken sign', 'signboard bent', 'signboard'] },
  { cls: 'broken_railing', triggers: ['broken railing', 'broken fence', 'railing damaged', 'railing'] },
  { cls: 'alligator_crack', triggers: ['alligator crack', 'crocodile crack', 'web crack'] },
  { cls: 'longitudinal_crack', triggers: ['longitudinal crack', 'lengthwise crack'] },
  { cls: 'transverse_crack', triggers: ['transverse crack', 'cross crack'] },
  { cls: 'pothole', triggers: ['pothole', 'deep hole', 'road crater', 'crater on road', 'road hole', 'potholes'] },
];

const CATEGORY_MAP: Record<CivicCategory, { classes: CivicDamageClass[]; words: string[] }> = {
  roads: {
    classes: ['pothole', 'longitudinal_crack', 'transverse_crack', 'alligator_crack'],
    words: ['pothole', 'road', 'asphalt', 'tar', 'crack', 'crater', 'bump', 'skid', 'tarmac'],
  },
  electrical: {
    classes: ['exposed_wire', 'damaged_pole', 'open_transformer', 'broken_streetlight'],
    words: ['electric', 'wire', 'cable', 'current', 'spark', 'pole', 'transformer', 'streetlight', 'light', 'dark', 'shock'],
  },
  waste: {
    classes: ['garbage_pile', 'overflowing_bin', 'debris'],
    words: ['garbage', 'trash', 'waste', 'bin', 'dump', 'smell', 'rubbish', 'debris', 'litter', 'plastic'],
  },
  water: {
    classes: ['open_manhole', 'waterlogging', 'pipe_leak'],
    words: ['water', 'leak', 'flood', 'waterlogging', 'manhole', 'drain', 'sewage', 'pipe', 'puddle', 'overflow'],
  },
  public_property: {
    classes: ['broken_footpath', 'damaged_signage', 'broken_railing'],
    words: ['footpath', 'sidewalk', 'pavement', 'signboard', 'sign', 'railing', 'fence', 'bench', 'park', 'public'],
  },
};

const URGENCY_WORDS = ['danger', 'emergency', 'accident', 'sparking', 'deep', 'urgent', 'hazard', 'severe', 'immediately', 'fatal'];

export class VoiceService {
  /**
   * Parse voice transcript and extract civic taxonomy, severity, and keywords
   */
  static parseSpeechTranscript(transcript: string, languageCode: string = 'en-IN'): ParsedVoiceReport {
    const rawLower = transcript.toLowerCase();

    let inferredCategory: CivicCategory | undefined;
    let inferredDamageClass: CivicDamageClass | undefined;
    let urgencyScore = 0;

    const extractedKeywords: VoiceKeywordToken[] = [];

    // 1. Detect longest matching damage class trigger
    for (const item of DAMAGE_CLASS_TRIGGERS) {
      for (const trigger of item.triggers) {
        if (rawLower.includes(trigger)) {
          inferredDamageClass = item.cls;
          extractedKeywords.push({
            word: trigger,
            confidence: 0.95,
            isCategoryTrigger: true,
            isUrgencyTrigger: false,
            isLocationTrigger: false,
          });
          break;
        }
      }
      if (inferredDamageClass) break;
    }

    // 2. Map detected class to category
    if (inferredDamageClass) {
      for (const [cat, data] of Object.entries(CATEGORY_MAP) as [CivicCategory, { classes: CivicDamageClass[]; words: string[] }][]) {
        if (data.classes.includes(inferredDamageClass)) {
          inferredCategory = cat;
          break;
        }
      }
    }

    // 3. Fallback category search if no class was matched
    if (!inferredCategory) {
      let maxMatches = 0;
      for (const [cat, data] of Object.entries(CATEGORY_MAP) as [CivicCategory, { classes: CivicDamageClass[]; words: string[] }][]) {
        let count = 0;
        for (const w of data.words) {
          if (new RegExp(`\\b${w}\\b`, 'i').test(rawLower)) {
            count++;
          }
        }
        if (count > maxMatches) {
          maxMatches = count;
          inferredCategory = cat;
        }
      }
    }

    if (!inferredCategory) {
      inferredCategory = 'roads';
    }
    if (!inferredDamageClass) {
      inferredDamageClass = CATEGORY_MAP[inferredCategory].classes[0];
    }

    // 4. Detect urgency
    for (const uWord of URGENCY_WORDS) {
      if (rawLower.includes(uWord)) {
        urgencyScore += 1;
        extractedKeywords.push({
          word: uWord,
          confidence: 0.95,
          isCategoryTrigger: false,
          isUrgencyTrigger: true,
          isLocationTrigger: false,
        });
      }
    }

    let inferredSeverity: ParsedVoiceReport['inferredSeverity'] = 'MEDIUM';
    if (urgencyScore >= 2 || inferredDamageClass === 'exposed_wire' || inferredDamageClass === 'open_manhole') {
      inferredSeverity = 'CRITICAL';
    } else if (urgencyScore === 1) {
      inferredSeverity = 'HIGH';
    } else if (inferredDamageClass === 'broken_footpath' || inferredDamageClass === 'debris') {
      inferredSeverity = 'LOW';
    }

    // 5. Detect landmarks
    let detectedLandmark: string | undefined;
    const landmarkMatch = transcript.match(/(?:near|opposite|behind|beside|at)\s+([A-Za-z0-9\s,]+?)(?:\.|$|,)/i);
    if (landmarkMatch && landmarkMatch[1]) {
      detectedLandmark = landmarkMatch[1].trim();
      extractedKeywords.push({
        word: detectedLandmark,
        confidence: 0.85,
        isCategoryTrigger: false,
        isUrgencyTrigger: false,
        isLocationTrigger: true,
      });
    }

    const cleanSummary = transcript.length > 80 ? transcript.slice(0, 77) + '...' : transcript;

    return {
      rawTranscript: transcript,
      cleanSummary,
      inferredCategory,
      inferredDamageClass,
      inferredSeverity,
      detectedLandmark,
      extractedKeywords,
      confidenceScore: Math.min(0.98, 0.75 + (inferredDamageClass ? 0.2 : 0)),
      languageCode,
    };
  }

  /**
   * Generate mock audio metering samples for visual waveform animation
   */
  static generateWaveformSamples(count: number = 32): number[] {
    const samples: number[] = [];
    for (let i = 0; i < count; i++) {
      const val = 0.15 + Math.random() * 0.7 * Math.sin((i / count) * Math.PI);
      samples.push(Math.round(val * 100) / 100);
    }
    return samples;
  }
}
