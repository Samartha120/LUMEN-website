export type PriorityLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type PriorityFactors = {
  categoryScore: number;
  confidenceScore: number;
  duplicateScore: number;
  locationScore: number;
  ageScore: number;
  departmentScore: number;
};

export type SeverityBand = "SEVERE" | "SIGNIFICANT" | "MODERATE" | "MINOR" | "NONE";

export type ComplaintStatus =
  | "SUBMITTED"
  | "ASSIGNED"
  | "IN_PROGRESS"
  | "PENDING_REVIEW"
  | "CLOSED"
  | "REJECTED";

export type Department = { name: string };

export type EngineerRef = {
  id?: string;
  name: string;
  code?: string;
  zone?: string;
};

export type DuplicateRef = { ref: string; title?: string };

export type ImageKind = "CITIZEN" | "ENGINEER_AFTER" | "ENGINEER_BEFORE";

export type ComplaintImage = {
  id: string;
  kind: ImageKind | string;
  path: string;
  annotated: string | null;
  severity: number | null;
};

export type Detection = {
  label: string;
  confidence: number;
  box: number[];
  area_ratio: number;
};

export type TimelineEvent = {
  id: string;
  type: string;
  message: string;
  actor: string;
  createdAt: string;
};

/** Shared base fields present on every complaint view. */
export type BaseComplaint = {
  id: string;
  ref: string;
  title: string;
  category: string;
  status: ComplaintStatus | string;
  priority: string;
  severityScore: number | null;
  severityBand: SeverityBand | string | null;
  duplicateOfId: string | null;
  verifyVerdict: string | null;
  createdAt: string;
  engineer: EngineerRef | null;
  // Priority engine fields (Feature 3)
  priorityScore?: number;
  priorityLevel?: PriorityLevel | string;
  priorityReasons?: string[];
  priorityFactors?: PriorityFactors;
  duplicateCount?: number;
};

/** Dashboard complaint row. */
export type DashboardComplaint = BaseComplaint & {
  description?: string;
  zone?: string;
  address?: string;
  lat?: number;
  lng?: number;
  department?: Department;
  aiModelMode?: string | null;
};

/** Complaint listing row (Complaints page). */
export type ListingComplaint = DashboardComplaint & {
  zone: string;
  department: Department;
  aiModelMode: string | null;
  duplicateOf: DuplicateRef | null;
  address: string;
  lat: number;
  lng: number;
};

/** Full complaint detail (ComplaintDetail page). */
export type ComplaintDetail = ListingComplaint & {
  description: string;
  zone: string;
  address: string;
  lat: number;
  lng: number;
  slaHours: number;
  department: Department;
  aiModelMode: string | null;
  aiConfidence: number | null;
  detections: string | null;
  dupSimilarity?: number | null;
  dupDistanceM?: number | null;
  verifyReason?: string | null;
  verifyReduction?: number | null;
  verifySsim?: number | null;
  assignMethod?: string | null;
  assignDistance?: number | null;
  images: ComplaintImage[];
  events: TimelineEvent[];
  duplicateOf: DuplicateRef | null;
  engineer: (EngineerRef & { code: string; zone: string }) | null;
};

/** Complaint + assignment pair returned from /api/assignment. */
export type AssignmentComplaintSummary = {
  id: string;
  ref: string;
  category: string;
  severityScore: number;
  priorityScore?: number;
  priorityLevel?: PriorityLevel | string;
  priorityReasons?: string[];
  priorityFactors?: PriorityFactors;
  duplicateCount?: number;
  zone?: string;
  address?: string;
  lat?: number;
  lng?: number;
  createdAt?: string;
  department?: Department;
};

export type AssignmentEngineerSummary = {
  code: string;
  name: string;
  openJobs: number;
  zone: string;
};

export type AssignmentRow = {
  complaint: AssignmentComplaintSummary;
  engineer: AssignmentEngineerSummary;
  distanceKm: number;
  cost: number;
  skillMatch: boolean;
};

export type AssignmentTitlesMap = Record<
  string,
  {
    title: string;
    priority: string;
    priorityLevel?: PriorityLevel | string;
    priorityScore?: number;
    priorityReasons?: string[];
    priorityFactors?: PriorityFactors;
    duplicateCount?: number;
    category?: string;
    zone?: string;
    createdAt?: string;
  }
>;

export type AssignmentResult = {
  assignments: AssignmentRow[];
  unassigned: unknown[];
  totalCost: number;
  naiveTotalCost: number;
  costImprovementPct: number;
  totalDistanceKm: number;
  naiveTotalDistanceKm: number;
};

export type AssignmentData = {
  result: AssignmentResult;
  titles: AssignmentTitlesMap;
  engineerCount: number;
};

/** Helpers to safely interpret union-ish values. */
export function toPriorityLevel(v?: PriorityLevel | string | null): PriorityLevel {
  switch (v) {
    case "CRITICAL":
    case "HIGH":
    case "MEDIUM":
    case "LOW":
      return v;
    default:
      return "LOW";
  }
}

export const PRIORITY_LEVEL_ORDER: Record<PriorityLevel, number> = {
  CRITICAL: 4,
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
};

export const FACTOR_MAX: Record<keyof PriorityFactors, number> = {
  categoryScore: 25,
  confidenceScore: 15,
  duplicateScore: 15,
  locationScore: 20,
  ageScore: 10,
  departmentScore: 15,
};

export const FACTOR_LABEL: Record<keyof PriorityFactors, string> = {
  categoryScore: "AI Severity",
  confidenceScore: "Confidence",
  duplicateScore: "Duplicates",
  locationScore: "Location",
  ageScore: "Age",
  departmentScore: "Department",
};
