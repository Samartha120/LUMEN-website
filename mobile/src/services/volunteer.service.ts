/**
 * Citizen volunteer drives, neighborhood cleanups, and civic hour tracking service.
 */

import { VolunteerDrive, VolunteerHourRecord, VolunteerTask } from '../types/volunteer.types';
import { StorageService } from './storage.service';

const DRIVES_CACHE_KEY = 'volunteer_drives_list';
const VOLUNTEER_HOURS_KEY = 'citizen_volunteer_hours';

const INITIAL_DRIVES: VolunteerDrive[] = [
  {
    id: 'drive-101',
    title: 'Indiranagar 100ft Road Neighborhood Cleanup & Pothole Tagging Drive',
    description: 'Join local ward champions and college volunteers to clear plastic waste from drainage inlets and mark deep road hazards with high-visibility chalk for rapid repair dispatch.',
    category: 'waste',
    organizer: {
      id: 'org-1',
      name: 'Clean City Bengaluru Foundation',
      role: 'WARD_CHAMPION',
      karmaTier: 'PLATINUM_GUARDIAN',
      karmaPoints: 4200,
      badgeTitle: 'Lead Community Organizer',
      isVerifiedCitizen: true,
    },
    location: {
      coordinate: { latitude: 12.9780, longitude: 77.6400 },
      address: '100ft Road Metro Station Entrance, Indiranagar',
      ward: 'Ward 112 - Domlur',
      city: 'Bengaluru',
    },
    scheduledDate: new Date(Date.now() + 86400 * 1000 * 3).toISOString(),
    durationHours: 3,
    status: 'UPCOMING',
    maxParticipants: 40,
    currentRsvpCount: 28,
    hasUserRsvp: false,
    tasks: [
      {
        id: 'tsk-1',
        title: 'Drain Inlet Debris Clearance',
        description: 'Clear plastic bottles and dried leaves from stormwater grating.',
        requiredVolunteers: 12,
        assignedVolunteersCount: 10,
        isCompleted: false,
        equipmentProvided: ['Heavy Duty Gloves', 'Trash Pickers', 'Recycling Bags'],
      },
      {
        id: 'tsk-2',
        title: 'Road Hazard Chalk Demarcation',
        description: 'Spray paint safety outlines around potholes to alert two-wheelers.',
        requiredVolunteers: 8,
        assignedVolunteersCount: 6,
        isCompleted: false,
        equipmentProvided: ['Reflective Vests', 'Eco-Chalk Spray'],
      },
      {
        id: 'tsk-3',
        title: 'Civic App Awareness Helpdesk',
        description: 'Demonstrate LUMEN mobile reporting to neighborhood shopkeepers.',
        requiredVolunteers: 6,
        assignedVolunteersCount: 4,
        isCompleted: false,
        equipmentProvided: ['Pamphlets', 'Demo Tablets'],
      },
    ],
    requiredItemsToBring: ['Reusable Water Bottle', 'Comfortable Walking Shoes', 'Sun Cap'],
    providedPerks: ['Refreshments & Fresh Juice', 'Volunteer Certificate', '250 Civic Karma Points', 'Sanitation Safety Kit'],
    karmaRewardPoints: 250,
    photos: ['https://images.unsplash.com/photo-1593113598332-cd288d649433?w=600'],
    impactSummary: {
      wasteClearedKg: 0,
      potholesMarkedCount: 0,
    },
    createdAt: new Date().toISOString(),
  },
  {
    id: 'drive-102',
    title: 'Koramangala 4th Block Green Corridor Tree Planting & Sidewalk Repair',
    description: 'Planting 50 native saplings along pedestrian walkways and replacing broken interlocking pavement tiles with local ward engineers.',
    category: 'public_property',
    organizer: {
      id: 'org-2',
      name: 'Koramangala Resident Welfare Assoc.',
      role: 'WARD_CHAMPION',
      karmaTier: 'GOLD',
      karmaPoints: 2900,
      isVerifiedCitizen: true,
    },
    location: {
      coordinate: { latitude: 12.9352, longitude: 77.6245 },
      address: '4th Block Park Perimeter, Koramangala',
      ward: 'Ward 80 - Koramangala',
      city: 'Bengaluru',
    },
    scheduledDate: new Date(Date.now() + 86400 * 1000 * 6).toISOString(),
    durationHours: 4,
    status: 'UPCOMING',
    maxParticipants: 50,
    currentRsvpCount: 44,
    hasUserRsvp: true,
    tasks: [
      {
        id: 'tsk-201',
        title: 'Sapling Pit Preparation',
        description: 'Digging planting pits with organic compost.',
        requiredVolunteers: 20,
        assignedVolunteersCount: 18,
        isCompleted: false,
        equipmentProvided: ['Spades', 'Organic Compost Bags'],
      },
    ],
    requiredItemsToBring: ['Gardening Gloves', 'Sunscreen'],
    providedPerks: ['Tree Adoption Certificate', '300 Karma Points', 'Snacks'],
    karmaRewardPoints: 300,
    photos: ['https://images.unsplash.com/photo-1542601906990-b4d3fb778b09?w=600'],
    createdAt: new Date().toISOString(),
  },
];

export class VolunteerService {
  /**
   * Get all volunteer drives
   */
  static async getDrives(): Promise<VolunteerDrive[]> {
    const cached = await StorageService.getItem<VolunteerDrive[]>(DRIVES_CACHE_KEY);
    if (cached && cached.length > 0) return cached;

    // Nothing cached yet: seed from the bundled sample and keep it, so the
    // next call is a straight read. Deep-copied because the sample is a module
    // constant and callers mutate what they are given.
    const seeded: VolunteerDrive[] = JSON.parse(JSON.stringify(INITIAL_DRIVES));
    await StorageService.setItem(DRIVES_CACHE_KEY, seeded);
    return seeded;
  }

  /**
   * Toggle citizen RSVP for a drive
   */
  static async toggleRsvp(driveId: string): Promise<{ hasUserRsvp: boolean; newCount: number }> {
    const drives = await this.getDrives();
    const drive = drives.find(d => d.id === driveId);
    if (!drive) throw new Error('Drive not found');

    if (drive.hasUserRsvp) {
      drive.hasUserRsvp = false;
      drive.currentRsvpCount = Math.max(0, drive.currentRsvpCount - 1);
    } else {
      if (drive.currentRsvpCount >= drive.maxParticipants) {
        throw new Error('This volunteer drive has reached capacity');
      }
      drive.hasUserRsvp = true;
      drive.currentRsvpCount += 1;
    }

    await StorageService.setItem(DRIVES_CACHE_KEY, drives);
    return { hasUserRsvp: drive.hasUserRsvp, newCount: drive.currentRsvpCount };
  }

  /**
   * Get user logged volunteer hours
   */
  static async getVolunteerHours(citizenId: string = 'current-user'): Promise<VolunteerHourRecord[]> {
    const hours = await StorageService.getItem<VolunteerHourRecord[]>(VOLUNTEER_HOURS_KEY);
    if (hours) return hours;

    const initialHours: VolunteerHourRecord[] = [
      {
        id: 'vh-1',
        citizenId,
        driveId: 'drive-past-1',
        driveTitle: 'HAL Airport Road Drainage Clearance',
        date: new Date(Date.now() - 86400 * 1000 * 12).toISOString(),
        hoursContributed: 3.5,
        karmaPointsEarned: 250,
        verifiedByOrganizer: true,
        certificateUrl: 'https://lumen.gov/certificates/vol-9021.pdf',
      },
    ];

    await StorageService.setItem(VOLUNTEER_HOURS_KEY, initialHours);
    return initialHours;
  }
}
