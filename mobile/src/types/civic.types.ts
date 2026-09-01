/**
 * Civic domain type definitions for LUMEN platform.
 */

export type CivicCategory = 'roads' | 'electrical' | 'waste' | 'water' | 'public_property';

export type CivicDamageClass =
  // Roads
  | 'pothole'
  | 'longitudinal_crack'
  | 'transverse_crack'
  | 'alligator_crack'
  // Electrical
  | 'exposed_wire'
  | 'damaged_pole'
  | 'open_transformer'
  | 'broken_streetlight'
  // Waste
  | 'garbage_pile'
  | 'overflowing_bin'
  | 'debris'
  // Water
  | 'open_manhole'
  | 'waterlogging'
  | 'pipe_leak'
  // Public Property
  | 'broken_footpath'
  | 'damaged_signage'
  | 'broken_railing';

export type ComplaintStatus =
  | 'SUBMITTED'
  | 'TRIAGED'
  | 'ASSIGNED'
  | 'IN_PROGRESS'
  | 'WORK_COMPLETED'
  | 'VERIFIED'
  | 'RESOLVED'
  | 'REJECTED'
  | 'ESCALATED';

export type PriorityLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | 'EMERGENCY';

export type UserRole = 'CITIZEN' | 'FIELD_ENGINEER' | 'SUPERVISOR' | 'ADMINISTRATOR';

export interface GeoCoordinate {
  latitude: number;
  longitude: number;
  accuracy?: number;
  altitude?: number;
  heading?: number;
  speed?: number;
  timestamp?: number;
}

export interface CivicLocation {
  coordinate: GeoCoordinate;
  address: string;
  landmark?: string;
  ward?: string;
  zone?: string;
  pincode?: string;
  city?: string;
}

export interface BoundingBox {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  confidence: number;
  class_name: CivicDamageClass;
}

export interface AIDetectionResult {
  detected_classes: CivicDamageClass[];
  primary_class: CivicDamageClass;
  category: CivicCategory;
  confidence: number;
  severity_score: number; // 0 - 100
  estimated_surface_area_sqm?: number;
  estimated_depth_cm?: number;
  boxes: BoundingBox[];
  model_mode: 'TRAINED' | 'HEURISTIC' | 'FALLBACK';
  processing_time_ms: number;
}

export interface CivicComplaint {
  id: string;
  ticketNumber: string;
  citizenId: string;
  citizenName?: string;
  citizenPhone?: string;
  title: string;
  description: string;
  category: CivicCategory;
  damageClass: CivicDamageClass;
  status: ComplaintStatus;
  priority: PriorityLevel;
  priorityScore: number; // 0 - 100
  location: CivicLocation;
  photoUrl: string;
  thumbnailUrl?: string;
  additionalPhotos?: string[];
  audioNoteUrl?: string;
  audioDurationSeconds?: number;
  aiDetection?: AIDetectionResult;
  assignedDepartment: string;
  assignedEngineerId?: string;
  assignedEngineerName?: string;
  slaDeadline: string; // ISO 8601
  slaHours: number;
  slaBreached: boolean;
  duplicateScore?: number;
  duplicateOfId?: string;
  upvoteCount: number;
  commentCount: number;
  hasUpvoted?: boolean;
  isBookmarked?: boolean;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
  verifiedAt?: string;
  repairVerification?: RepairVerificationRecord;
  auditTrail: AuditLogEntry[];
}

export interface RepairVerificationRecord {
  beforePhotoUrl: string;
  afterPhotoUrl: string;
  verifiedBy: string;
  verifiedAt: string;
  aiSimilarityScore: number;
  damageResolvedScore: number;
  confidence: number;
  verdict: 'APPROVED' | 'REQUIRES_REWORK' | 'MANUAL_REVIEW_NEEDED';
  notes?: string;
}

export interface AuditLogEntry {
  id: string;
  complaintId: string;
  actorId: string;
  actorName: string;
  actorRole: UserRole;
  action: string;
  fromStatus?: ComplaintStatus;
  toStatus?: ComplaintStatus;
  notes?: string;
  timestamp: string;
}

export interface DepartmentInfo {
  id: string;
  name: string;
  category: CivicCategory;
  leadSupervisor: string;
  contactEmail: string;
  contactPhone: string;
  defaultSlaHours: number;
  activeComplaintsCount: number;
  resolvedComplaintsCount: number;
  avgResolutionTimeHours: number;
  complianceRate: number; // 0 - 100%
}
