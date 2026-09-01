/**
 * Volunteer drives, community cleanup initiatives, and civic hour logging types.
 */

import { CivicCategory, CivicLocation, GeoCoordinate } from './civic.types';
import { AuthorProfile } from './community.types';

export type DriveStatus = 'UPCOMING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

export interface VolunteerTask {
  id: string;
  title: string;
  description: string;
  requiredVolunteers: number;
  assignedVolunteersCount: number;
  isCompleted: boolean;
  equipmentProvided: string[];
}

export interface VolunteerDrive {
  id: string;
  title: string;
  description: string;
  category: CivicCategory;
  organizer: AuthorProfile;
  location: CivicLocation;
  scheduledDate: string; // ISO 8601
  durationHours: number;
  status: DriveStatus;
  maxParticipants: number;
  currentRsvpCount: number;
  hasUserRsvp: boolean;
  tasks: VolunteerTask[];
  requiredItemsToBring: string[];
  providedPerks: string[]; // e.g. "Gloves", "Refreshments", "Civic Certificate", "+200 Karma"
  karmaRewardPoints: number;
  photos: string[];
  impactSummary?: {
    wasteClearedKg?: number;
    potholesMarkedCount?: number;
    treesPlantedCount?: number;
    drainsDesiltedMeters?: number;
  };
  createdAt: string;
}

export interface VolunteerHourRecord {
  id: string;
  citizenId: string;
  driveId: string;
  driveTitle: string;
  date: string;
  hoursContributed: number;
  karmaPointsEarned: number;
  verifiedByOrganizer: boolean;
  certificateUrl?: string;
}
