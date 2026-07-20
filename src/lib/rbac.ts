export const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  ADMINISTRATOR: "Administrator",
  COMMISSIONER: "Commissioner",
  DEPARTMENT_MANAGER: "Department Manager",
  SUPERVISOR: "Supervisor",
  ENGINEER: "Engineer",
  ANALYST: "Analyst",
  AUDITOR: "Auditor",
};

export const ALL_ROLES = Object.keys(ROLE_LABELS);

export type NavItem = {
  key: string;
  label: string;
  href: string;
  icon: string; // lucide icon name resolved in the Sidebar client component
  roles: string[];
};

// Role-aware navigation per Part 3/6 of the blueprint: items a role lacks are
// hidden entirely, never disabled.
export const NAV_ITEMS: NavItem[] = [
  { key: "dashboard", label: "Dashboard", href: "/app/dashboard", icon: "LayoutDashboard", roles: ALL_ROLES },
  { key: "complaints", label: "Complaints", href: "/app/complaints", icon: "ClipboardList", roles: ["ADMINISTRATOR", "DEPARTMENT_MANAGER", "SUPERVISOR", "ENGINEER", "ANALYST", "AUDITOR"] },
  { key: "gis", label: "GIS Console", href: "/app/gis", icon: "Map", roles: ["DEPARTMENT_MANAGER", "SUPERVISOR", "ENGINEER", "ANALYST", "COMMISSIONER", "ADMINISTRATOR"] },
  { key: "departments", label: "Departments", href: "/app/departments", icon: "Building2", roles: ["ADMINISTRATOR", "COMMISSIONER", "DEPARTMENT_MANAGER", "SUPER_ADMIN"] },
  { key: "engineers", label: "Engineers", href: "/app/engineers", icon: "HardHat", roles: ["ADMINISTRATOR", "DEPARTMENT_MANAGER", "SUPERVISOR"] },
  { key: "citizens", label: "Citizens", href: "/app/citizens", icon: "Users", roles: ["ADMINISTRATOR", "DEPARTMENT_MANAGER", "SUPERVISOR", "AUDITOR"] },
  { key: "assets", label: "Assets", href: "/app/assets", icon: "Boxes", roles: ["ADMINISTRATOR", "DEPARTMENT_MANAGER", "ENGINEER", "SUPERVISOR"] },
  { key: "analytics", label: "Analytics", href: "/app/analytics", icon: "BarChart3", roles: ["ANALYST", "DEPARTMENT_MANAGER", "COMMISSIONER", "ADMINISTRATOR"] },
  { key: "reports", label: "Reports", href: "/app/reports", icon: "FileText", roles: ["DEPARTMENT_MANAGER", "ANALYST", "COMMISSIONER", "ADMINISTRATOR"] },
  { key: "ai-insights", label: "AI Insights", href: "/app/ai-insights", icon: "Sparkles", roles: ["ANALYST", "DEPARTMENT_MANAGER", "COMMISSIONER", "SUPERVISOR"] },
  { key: "notifications", label: "Notifications", href: "/app/notifications", icon: "Bell", roles: ALL_ROLES },
  { key: "audit-logs", label: "Audit Logs", href: "/app/audit-logs", icon: "ScrollText", roles: ["AUDITOR", "ADMINISTRATOR", "SUPER_ADMIN"] },
  { key: "monitoring", label: "Monitoring", href: "/app/monitoring", icon: "Activity", roles: ["SUPER_ADMIN", "ADMINISTRATOR"] },
  { key: "security", label: "Security Center", href: "/app/security", icon: "ShieldCheck", roles: ["SUPER_ADMIN", "ADMINISTRATOR"] },
  { key: "settings", label: "Settings", href: "/app/settings", icon: "Settings", roles: ["ADMINISTRATOR", "SUPER_ADMIN"] },
];

export function navForRole(role: string): NavItem[] {
  return NAV_ITEMS.filter((i) => i.roles.includes(role));
}

export function canAccess(role: string, moduleKey: string): boolean {
  const item = NAV_ITEMS.find((i) => i.key === moduleKey);
  return item ? item.roles.includes(role) : false;
}

// Complaint state machine (Part 8.6) — status -> allowed transitions with the
// roles permitted to perform each one.
export type Transition = { to: string; label: string; roles: string[] };

const MANAGERIAL = ["DEPARTMENT_MANAGER", "SUPERVISOR", "ADMINISTRATOR"];

export const TRANSITIONS: Record<string, Transition[]> = {
  SUBMITTED: [{ to: "UNDER_REVIEW", label: "Move to Under Review", roles: MANAGERIAL }],
  UNDER_REVIEW: [
    { to: "ASSIGNED", label: "Assign to Engineer", roles: MANAGERIAL },
    { to: "REJECTED", label: "Reject (invalid / duplicate)", roles: MANAGERIAL },
  ],
  ASSIGNED: [
    { to: "IN_PROGRESS", label: "Start Work", roles: ["ENGINEER", ...MANAGERIAL] },
    { to: "ESCALATED", label: "Escalate", roles: MANAGERIAL },
  ],
  IN_PROGRESS: [
    { to: "PENDING_REVIEW", label: "Mark Complete (send for review)", roles: ["ENGINEER", ...MANAGERIAL] },
    { to: "ESCALATED", label: "Escalate", roles: MANAGERIAL },
  ],
  PENDING_REVIEW: [
    { to: "CLOSED", label: "Approve Closure", roles: MANAGERIAL },
    { to: "IN_PROGRESS", label: "Reject — Rework Required", roles: MANAGERIAL },
  ],
  ESCALATED: [{ to: "ASSIGNED", label: "Re-assign after Review", roles: MANAGERIAL }],
  CLOSED: [{ to: "REOPENED", label: "Reopen (citizen dispute)", roles: MANAGERIAL }],
  REOPENED: [{ to: "ASSIGNED", label: "Re-assign for Action", roles: MANAGERIAL }],
  REJECTED: [],
};

export const STATUS_LABELS: Record<string, string> = {
  SUBMITTED: "Submitted",
  UNDER_REVIEW: "Under Review",
  ASSIGNED: "Assigned",
  IN_PROGRESS: "In Progress",
  PENDING_REVIEW: "Pending Review",
  ESCALATED: "Escalated",
  CLOSED: "Closed",
  REOPENED: "Reopened",
  REJECTED: "Rejected",
};
