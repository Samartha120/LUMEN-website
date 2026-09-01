import { AssetService } from '../src/services/asset.service';
import { StorageService } from '../src/services/storage.service';

describe('AssetService Tests', () => {
  beforeEach(async () => {
    await StorageService.clearAll();
  });

  test('scans and retrieves asset by QR tag', async () => {
    const asset = await AssetService.getAssetByTag('LMN-QR-BLR-00812');
    expect(asset).toBeDefined();
    expect(asset?.name).toContain('LED Pole');
    expect(asset?.healthScore).toBeGreaterThan(80);
  });

  test('retrieves all registered municipal assets', async () => {
    const assets = await AssetService.getAllAssets();
    expect(assets.length).toBeGreaterThanOrEqual(3);
    assets.forEach(a => {
      expect(a.qrCodeTag).toBeDefined();
      expect(a.location).toBeDefined();
    });
  });
});
