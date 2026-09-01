import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Alert } from 'react-native';
import { theme } from '../theme';
import { Icon } from '../Icon';
import { AssetCard } from '../components/AssetCard';
import { MunicipalAsset } from '../types/asset.types';
import { AssetService } from '../services/asset.service';
import { HapticFeedback } from '../utils/haptics';

export const AssetScannerScreen: React.FC<{ navigation?: any }> = ({ navigation }) => {
  const [searchTag, setSearchTag] = useState('');
  const [scannedAsset, setScannedAsset] = useState<MunicipalAsset | null>(null);
  const [allAssets, setAllAssets] = useState<MunicipalAsset[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    AssetService.getAllAssets().then(setAllAssets);
  }, []);

  const handleSearch = async (tag: string) => {
    if (!tag.trim()) return;
    setLoading(true);
    try {
      const ast = await AssetService.getAssetByTag(tag);
      setScannedAsset(ast);
      if (!ast) {
        Alert.alert('Asset Not Found', 'No registered municipal asset found matching this QR code or tag.');
      } else {
        HapticFeedback.success();
      }
    } finally {
      setLoading(false);
    }
  };

  const simulateQrScan = (asset: MunicipalAsset) => {
    HapticFeedback.medium();
    setSearchTag(asset.qrCodeTag);
    setScannedAsset(asset);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Scanner Visual Viewport */}
      <View style={styles.scannerBox}>
        <View style={styles.reticleOverlay}>
          <View style={[styles.corner, styles.cornerTL]} />
          <View style={[styles.corner, styles.cornerTR]} />
          <View style={[styles.corner, styles.cornerBL]} />
          <View style={[styles.corner, styles.cornerBR]} />
        </View>

        <Icon name="scan-outline" size={48} color="rgba(255, 255, 255, 0.4)" />
        <Text style={styles.scannerPrompt}>
          Point camera at QR code tag on Streetlight, Transformer, or Drain Slab
        </Text>
      </View>

      {/* Manual Tag Input Bar */}
      <View style={styles.inputBar}>
        <TextInput
          style={styles.textInput}
          placeholder="Or enter Asset Tag (e.g. LMN-QR-BLR-00812)"
          placeholderTextColor={theme.colors.textMuted}
          value={searchTag}
          onChangeText={setSearchTag}
          autoCapitalize="characters"
        />
        <TouchableOpacity
          style={styles.searchBtn}
          onPress={() => handleSearch(searchTag)}
        >
          <Icon name="search" size={16} color="#FFFFFF" />
        </TouchableOpacity>
      </View>

      {/* Scanned Asset Result */}
      {scannedAsset && (
        <View style={styles.resultContainer}>
          <Text style={styles.resultHeader}>Scanned Municipal Asset</Text>
          <AssetCard
            asset={scannedAsset}
            onPressReportIssue={() => {
              Alert.alert(
                'File Asset Complaint',
                `Prefilling report for ${scannedAsset.name} (#${scannedAsset.qrCodeTag}).`,
                [
                  {
                    text: 'Continue to Report',
                    onPress: () => navigation?.navigate?.('report'),
                  },
                ]
              );
            }}
          />
        </View>
      )}

      {/* Quick demo tags list */}
      <Text style={styles.quickTagsHeader}>Demo Registered Assets:</Text>
      <View style={styles.demoList}>
        {allAssets.map(ast => (
          <TouchableOpacity
            key={ast.id}
            style={styles.demoTagBtn}
            onPress={() => simulateQrScan(ast)}
          >
            <Icon name="qr-code" size={14} color={theme.colors.primary} />
            <Text style={styles.demoTagText}>
              {ast.name} ({ast.qrCodeTag})
            </Text>
          </TouchableOpacity>
        ))}
      </View>
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
  scannerBox: {
    height: 200,
    backgroundColor: '#0F172A',
    borderRadius: theme.radius.xl,
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.lg,
    position: 'relative',
    marginBottom: theme.spacing.md,
    overflow: 'hidden',
  },
  reticleOverlay: {
    ...StyleSheet.absoluteFillObject,
    margin: 24,
  },
  corner: {
    position: 'absolute',
    width: 20,
    height: 20,
    borderColor: '#3B82F6',
  },
  cornerTL: { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3 },
  cornerTR: { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3 },
  cornerBL: { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3 },
  cornerBR: { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3 },
  scannerPrompt: {
    color: '#94A3B8',
    fontSize: theme.typography.sizes.xs,
    textAlign: 'center',
    marginTop: 12,
    maxWidth: 240,
    lineHeight: 16,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: theme.spacing.md,
  },
  textInput: {
    flex: 1,
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.lg,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.text,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  searchBtn: {
    width: 44,
    height: 44,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultContainer: {
    marginBottom: theme.spacing.md,
  },
  resultHeader: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: '800',
    color: theme.colors.text,
    marginBottom: 8,
  },
  quickTagsHeader: {
    fontSize: 11,
    fontWeight: '700',
    color: theme.colors.textMuted,
    marginTop: 4,
    marginBottom: 8,
  },
  demoList: {
    gap: 6,
  },
  demoTagBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: theme.colors.card,
    borderRadius: theme.radius.md,
    padding: 10,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  demoTagText: {
    fontSize: 11,
    fontWeight: '600',
    color: theme.colors.text,
  },
});
