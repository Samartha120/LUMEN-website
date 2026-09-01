import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { theme } from '../theme';
import { Icon } from '../Icon';
import { AudioRecorder } from '../components/AudioRecorder';
import { VoiceService } from '../services/voice.service';
import { ParsedVoiceReport } from '../types/voice.types';
import { formatCategoryName, formatDamageClassName } from '../utils/string';
import { HapticFeedback } from '../utils/haptics';

export const VoiceReportScreen: React.FC<{ navigation?: any }> = ({ navigation }) => {
  const [parsedReport, setParsedReport] = useState<ParsedVoiceReport | null>(null);
  const [audioMeta, setAudioMeta] = useState<{ uri: string; duration: number } | null>(null);

  const handleAudioComplete = (uri: string, duration: number) => {
    // Simulate intelligent NLP speech extraction
    const mockSpeech =
      'There is a deep pothole near Indiranagar 8th Main Junction opposite the metro entrance. Water is leaking and two scooters skidded dangerously!';
    const parsed = VoiceService.parseSpeechTranscript(mockSpeech);
    setAudioMeta({ uri, duration });
    setParsedReport(parsed);
  };

  const handleSubmit = () => {
    if (!parsedReport) return;
    HapticFeedback.success();
    Alert.alert(
      'Voice Report Registered!',
      `Auto-classified under ${formatCategoryName(parsedReport.inferredCategory || 'roads')} (${formatDamageClassName(
        parsedReport.inferredDamageClass || 'pothole'
      )}). Auto-routing to dispatch queue with Priority ${parsedReport.inferredSeverity}.`,
      [
        {
          text: 'View Status',
          onPress: () => navigation?.navigate?.('LiveTracking', { complaintId: 'cmp-001' }),
        },
      ]
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <AudioRecorder onRecordingComplete={handleAudioComplete} />

      {/* Parsed AI breakdown */}
      {parsedReport && (
        <View style={styles.resultCard}>
          <View style={styles.aiBadge}>
            <Icon name="sparkles" size={14} color="#FFFFFF" />
            <Text style={styles.aiBadgeText}>AI Speech Extraction & Entity Resolution</Text>
          </View>

          <Text style={styles.transcriptLabel}>Transcribed Audio:</Text>
          <Text style={styles.transcriptText}>"{parsedReport.rawTranscript}"</Text>

          <View style={styles.entityGrid}>
            <View style={styles.entityBox}>
              <Text style={styles.entityLabel}>Inferred Category</Text>
              <Text style={styles.entityVal}>
                {formatCategoryName(parsedReport.inferredCategory || 'roads')}
              </Text>
            </View>

            <View style={styles.entityBox}>
              <Text style={styles.entityLabel}>Damage Class</Text>
              <Text style={styles.entityVal}>
                {formatDamageClassName(parsedReport.inferredDamageClass || 'pothole')}
              </Text>
            </View>

            <View style={styles.entityBox}>
              <Text style={styles.entityLabel}>Urgency / Severity</Text>
              <Text
                style={[
                  styles.entityVal,
                  {
                    color:
                      parsedReport.inferredSeverity === 'CRITICAL'
                        ? theme.colors.danger
                        : theme.colors.warning,
                  },
                ]}
              >
                {parsedReport.inferredSeverity}
              </Text>
            </View>

            <View style={styles.entityBox}>
              <Text style={styles.entityLabel}>Detected Landmark</Text>
              <Text style={styles.entityVal}>
                {parsedReport.detectedLandmark || '8th Main Junction'}
              </Text>
            </View>
          </View>

          {/* Keywords tags */}
          <View style={styles.keywordsRow}>
            <Text style={styles.keyLabel}>Extracted Keywords:</Text>
            <View style={styles.tagWrap}>
              {parsedReport.extractedKeywords.map((k, idx) => (
                <View
                  key={idx}
                  style={[
                    styles.kwTag,
                    k.isUrgencyTrigger && styles.kwTagUrgent,
                    k.isCategoryTrigger && styles.kwTagCat,
                  ]}
                >
                  <Text
                    style={[
                      styles.kwText,
                      k.isUrgencyTrigger && styles.kwTextUrgent,
                      k.isCategoryTrigger && styles.kwTextCat,
                    ]}
                  >
                    #{k.word}
                  </Text>
                </View>
              ))}
            </View>
          </View>

          <TouchableOpacity style={styles.submitBtn} onPress={handleSubmit}>
            <Text style={styles.submitText}>Confirm & Dispatch Voice Report</Text>
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    padding: theme.spacing.md,
    paddingBottom: 60,
  },
  resultCard: {
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
    marginTop: theme.spacing.md,
  },
  aiBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: theme.colors.primary,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: theme.radius.full,
    marginBottom: theme.spacing.md,
  },
  aiBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  transcriptLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.textMuted,
  },
  transcriptText: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.text,
    fontStyle: 'italic',
    lineHeight: 20,
    marginVertical: 6,
  },
  entityGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginVertical: theme.spacing.md,
  },
  entityBox: {
    width: '48%',
    backgroundColor: theme.colors.background,
    borderRadius: theme.radius.md,
    padding: 8,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  entityLabel: {
    fontSize: 10,
    color: theme.colors.textMuted,
    fontWeight: '600',
  },
  entityVal: {
    fontSize: 12,
    fontWeight: '800',
    color: theme.colors.text,
    marginTop: 2,
  },
  keywordsRow: {
    marginBottom: theme.spacing.md,
  },
  keyLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.textMuted,
    marginBottom: 6,
  },
  tagWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  kwTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.background,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  kwTagUrgent: {
    backgroundColor: '#FEF2F2',
    borderColor: theme.colors.danger,
  },
  kwTagCat: {
    backgroundColor: 'rgba(37, 99, 235, 0.08)',
    borderColor: theme.colors.primary,
  },
  kwText: {
    fontSize: 10,
    color: theme.colors.textMuted,
    fontWeight: '600',
  },
  kwTextUrgent: {
    color: theme.colors.danger,
    fontWeight: '800',
  },
  kwTextCat: {
    color: theme.colors.primary,
    fontWeight: '700',
  },
  submitBtn: {
    backgroundColor: theme.colors.primary,
    paddingVertical: 14,
    borderRadius: theme.radius.md,
    alignItems: 'center',
    marginTop: 4,
  },
  submitText: {
    color: '#FFFFFF',
    fontSize: theme.typography.sizes.sm,
    fontWeight: '700',
  },
});
