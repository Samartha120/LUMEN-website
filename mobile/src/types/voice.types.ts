/**
 * Voice reporting and speech transcription domain types.
 */

import { CivicCategory, CivicDamageClass, GeoCoordinate } from './civic.types';

export interface AudioRecordingState {
  isRecording: boolean;
  isPaused: boolean;
  durationMillis: number;
  meteringLevels: number[]; // amplitudes for waveform rendering (normalized 0.0 - 1.0)
  uri?: string;
  fileSize?: number;
}

export interface VoiceKeywordToken {
  word: string;
  confidence: number;
  isCategoryTrigger: boolean;
  isUrgencyTrigger: boolean;
  isLocationTrigger: boolean;
}

export interface ParsedVoiceReport {
  rawTranscript: string;
  cleanSummary: string;
  inferredCategory?: CivicCategory;
  inferredDamageClass?: CivicDamageClass;
  inferredSeverity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  detectedLandmark?: string;
  extractedKeywords: VoiceKeywordToken[];
  confidenceScore: number;
  languageCode: string;
}

export interface VoiceSubmissionPayload {
  audioUri: string;
  durationSeconds: number;
  transcript: string;
  category: CivicCategory;
  damageClass: CivicDamageClass;
  title: string;
  description: string;
  coordinate: GeoCoordinate;
  photoUri?: string;
}
