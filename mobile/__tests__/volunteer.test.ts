import { VolunteerService } from '../src/services/volunteer.service';
import { StorageService } from '../src/services/storage.service';

describe('VolunteerService Tests', () => {
  beforeEach(async () => {
    await StorageService.clearAll();
  });

  test('retrieves upcoming volunteer drives with tasks', async () => {
    const drives = await VolunteerService.getDrives();
    expect(drives.length).toBeGreaterThan(0);
    expect(drives[0].tasks.length).toBeGreaterThan(0);
    expect(drives[0].karmaRewardPoints).toBeGreaterThan(0);
  });

  test('toggles citizen RSVP for a drive', async () => {
    const drives = await VolunteerService.getDrives();
    const target = drives[0];
    const initialRsvp = target.hasUserRsvp;
    const initialCount = target.currentRsvpCount;

    const { hasUserRsvp, newCount } = await VolunteerService.toggleRsvp(target.id);
    expect(hasUserRsvp).toBe(!initialRsvp);
    if (!initialRsvp) {
      expect(newCount).toBe(initialCount + 1);
    } else {
      expect(newCount).toBe(initialCount - 1);
    }
  });

  test('retrieves logged volunteer service hours', async () => {
    const hours = await VolunteerService.getVolunteerHours();
    expect(hours.length).toBeGreaterThan(0);
    expect(hours[0].hoursContributed).toBeGreaterThan(0);
  });
});
