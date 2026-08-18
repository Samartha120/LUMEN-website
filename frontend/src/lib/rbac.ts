export const ROLE_LABELS: Record<string, string> = {
  ADMINISTRATOR: "Administrator",
  SUPERVISOR: "Supervisor",
  ENGINEER: "Field Engineer",
};

export const ALL_ROLES = Object.keys(ROLE_LABELS);

export type NavItem = {
  key: string;
  label: string;
  href: string;
  icon: string;
  roles: string[];
};

export const NAV_ITEMS: NavItem[] = [
  { key: "dashboard", label: "Dashboard", href: "/app/dashboard", icon: "LayoutDashboard", roles: ALL_ROLES },
  { key: "assistant", label: "Assistant", href: "/app/assistant", icon: "Sparkles", roles: ALL_ROLES },
  { key: "complaints", label: "Complaints", href: "/app/complaints", icon: "ClipboardList", roles: ALL_ROLES },
  { key: "gis", label: "GIS Map", href: "/app/gis", icon: "Map", roles: ALL_ROLES },
  { key: "estimate", label: "Material Estimate", href: "/app/estimate", icon: "Calculator", roles: ALL_ROLES },
  { key: "budget", label: "Budget Planner", href: "/app/budget", icon: "Wallet", roles: ["ADMINISTRATOR", "SUPERVISOR"] },
  { key: "assignment", label: "Assignment", href: "/app/assignment", icon: "HardHat", roles: ["ADMINISTRATOR", "SUPERVISOR"] },
  { key: "engineers", label: "Engineers", href: "/app/engineers", icon: "HardHat", roles: ["ADMINISTRATOR", "SUPERVISOR"] },
  { key: "audit-logs", label: "Audit Log", href: "/app/audit-logs", icon: "ScrollText", roles: ["ADMINISTRATOR", "SUPERVISOR"] },
];

export function navForRole(role: string): NavItem[] {
  return NAV_ITEMS.filter((i) => i.roles.includes(role));
}

export function canAccess(role: string, moduleKey: string): boolean {
  const item = NAV_ITEMS.find((i) => i.key === moduleKey);
  return item ? item.roles.includes(role) : false;
}

/** Complaint lifecycle. */
export type Transition = { to: string; label: string; roles: string[] };

const MANAGERIAL = ["SUPERVISOR", "ADMINISTRATOR"];

export const TRANSITIONS: Record<string, Transition[]> = {
  SUBMITTED: [
    { to: "ASSIGNED", label: "Assign Engineer", roles: MANAGERIAL },
    { to: "REJECTED", label: "Reject (invalid / duplicate)", roles: MANAGERIAL },
  ],
  ASSIGNED: [{ to: "IN_PROGRESS", label: "Start Work", roles: ["ENGINEER", ...MANAGERIAL] }],
  IN_PROGRESS: [{ to: "PENDING_REVIEW", label: "Mark Complete", roles: ["ENGINEER", ...MANAGERIAL] }],
  PENDING_REVIEW: [
    { to: "CLOSED", label: "Approve Closure", roles: MANAGERIAL },
    { to: "IN_PROGRESS", label: "Reject — Rework Required", roles: MANAGERIAL },
  ],
  CLOSED: [],
  REJECTED: [],
};

export const STATUS_LABELS: Record<string, string> = {
  SUBMITTED: "Submitted",
  ASSIGNED: "Assigned",
  IN_PROGRESS: "In Progress",
  PENDING_REVIEW: "Pending Review",
  CLOSED: "Closed",
  REJECTED: "Rejected",
};

export const DAMAGE_CLASSES = [
  "Pothole",
  "Alligator Crack",
  "Garbage Pile",
  "Overflowing Bin",
  "Open Manhole",
];
