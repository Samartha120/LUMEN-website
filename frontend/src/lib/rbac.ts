export const ROLE_LABELS: Record<string, string> = {
  ADMINISTRATOR: "Administrator",
  SUPERVISOR: "Supervisor",
  ENGINEER: "Field Engineer",
  CITIZEN: "Resident",
};

// STAFF_ROLES, not every role. ALL_ROLES used to be every key of ROLE_LABELS,
// and most nav items were granted to it — so adding CITIZEN above would have
// silently handed residents the budget planner, the engineer roster and the
// audit log. Staff access is now listed explicitly and a new role starts with
// nothing until it is named.
export const STAFF_ROLES = ["ADMINISTRATOR", "SUPERVISOR", "ENGINEER"];
export const ALL_ROLES = Object.keys(ROLE_LABELS);

export type NavItem = {
  key: string;
  label: string;
  href: string;
  icon: string;
  roles: string[];
};

export const NAV_ITEMS: NavItem[] = [
  // Residents get two entries and nothing else: report something, and follow
  // what they reported.
  { key: "report", label: "Report an Issue", href: "/app/complaints/new", icon: "Camera", roles: ["CITIZEN"] },
  { key: "my-reports", label: "My Reports", href: "/app/complaints", icon: "ClipboardList", roles: ["CITIZEN"] },

  { key: "dashboard", label: "Dashboard", href: "/app/dashboard", icon: "LayoutDashboard", roles: STAFF_ROLES },
  { key: "assistant", label: "Assistant", href: "/app/assistant", icon: "Sparkles", roles: STAFF_ROLES },
  { key: "complaints", label: "Complaints", href: "/app/complaints", icon: "ClipboardList", roles: STAFF_ROLES },
  { key: "gis", label: "GIS Map", href: "/app/gis", icon: "Map", roles: STAFF_ROLES },
  { key: "work-orders", label: "Work Orders", href: "/app/work-orders", icon: "Layers", roles: ["ADMINISTRATOR", "SUPERVISOR"] },
  { key: "estimate", label: "Material Estimate", href: "/app/estimate", icon: "Calculator", roles: STAFF_ROLES },
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

// The three classes the platform actually detects. Alligator Crack and
// Overflowing Bin were trained and measured (P 0.639/R 0.225 and P 0.500/
// R 0.444 on held-out data) and dropped as not fit to show a supervisor;
// they are suppressed in the detector and are not offered anywhere here.
export const DAMAGE_CLASSES = [
  "Pothole",
  "Garbage Pile",
  "Open Manhole",
  "Closed Manhole",
];
