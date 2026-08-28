import { Routes, Route, Navigate } from "react-router-dom";
import { PublicLayout } from "./pages/public/PublicLayout";
import { Landing } from "./pages/public/Landing";
import { About } from "./pages/public/About";
import { Features } from "./pages/public/Features";
import { Faq } from "./pages/public/Faq";
import { Contact } from "./pages/public/Contact";
import { Login } from "./pages/Login";
import { AppShell } from "./components/AppShell";
import { Dashboard } from "./pages/Dashboard";
import { Complaints } from "./pages/Complaints";
import { NewComplaint } from "./pages/NewComplaint";
import { ComplaintDetail } from "./pages/ComplaintDetail";
import { Assistant } from "./pages/Assistant";
import { Estimate } from "./pages/Estimate";
import { Budget } from "./pages/Budget";
import { Assignment } from "./pages/Assignment";
import { Gis } from "./pages/Gis";
import { Engineers } from "./pages/Engineers";
import { AuditLogs } from "./pages/AuditLogs";
import { WorkOrders } from "./pages/WorkOrders";
import { useAuth } from "./auth";
import { STAFF_ROLES } from "./lib/rbac";

/**
 * Renders its children only for staff. A resident is sent to their own reports
 * instead — this is the second half of the citizen boundary, the first being
 * that the server scopes every query by reporter. Neither alone is enough: the
 * sidebar hides the links, this stops a typed URL, and the API is what
 * actually protects the data.
 */
function StaffOnly({ children, to = "/app/complaints" }: { children: React.ReactNode; to?: string }) {
  const { user } = useAuth();
  if (user && !STAFF_ROLES.includes(user.role)) return <Navigate to={to} replace />;
  return <>{children}</>;
}

export function App() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route path="/" element={<Landing />} />
        <Route path="/about" element={<About />} />
        <Route path="/features" element={<Features />} />
        <Route path="/faq" element={<Faq />} />
        <Route path="/contact" element={<Contact />} />
      </Route>
      <Route path="/auth/login" element={<Login />} />
      <Route path="/app" element={<AppShell />}>
        {/* Residents land on their own reports; staff on the dashboard. */}
        <Route index element={<StaffOnly to="/app/complaints"><Navigate to="/app/dashboard" replace /></StaffOnly>} />
        <Route path="complaints" element={<Complaints />} />
        <Route path="complaints/new" element={<NewComplaint />} />
        <Route path="complaints/:ref" element={<ComplaintDetail />} />

        {/* Staff-only. Guarded here as well as hidden from the sidebar —
            hiding a link is presentation, not access control, and a resident
            typing /app/engineers must not reach the roster. */}
        <Route path="dashboard" element={<StaffOnly><Dashboard /></StaffOnly>} />
        <Route path="assistant" element={<StaffOnly><Assistant /></StaffOnly>} />
        <Route path="estimate" element={<StaffOnly><Estimate /></StaffOnly>} />
        <Route path="budget" element={<StaffOnly><Budget /></StaffOnly>} />
        <Route path="assignment" element={<StaffOnly><Assignment /></StaffOnly>} />
        <Route path="gis" element={<StaffOnly><Gis /></StaffOnly>} />
        <Route path="work-orders" element={<StaffOnly><WorkOrders /></StaffOnly>} />
        <Route path="engineers" element={<StaffOnly><Engineers /></StaffOnly>} />
        <Route path="audit-logs" element={<StaffOnly><AuditLogs /></StaffOnly>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
