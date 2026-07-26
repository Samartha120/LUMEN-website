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
import { Assignment } from "./pages/Assignment";
import { Gis } from "./pages/Gis";
import { Engineers } from "./pages/Engineers";
import { AuditLogs } from "./pages/AuditLogs";

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
        <Route index element={<Navigate to="/app/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="complaints" element={<Complaints />} />
        <Route path="complaints/new" element={<NewComplaint />} />
        <Route path="complaints/:ref" element={<ComplaintDetail />} />
        <Route path="assignment" element={<Assignment />} />
        <Route path="gis" element={<Gis />} />
        <Route path="engineers" element={<Engineers />} />
        <Route path="audit-logs" element={<AuditLogs />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
