import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requireSession } from "@/lib/auth";
import { PageHeader, Card } from "@/components/ui";
import { createComplaint } from "../actions";

export const metadata = { title: "New Complaint" };
export const dynamic = "force-dynamic";

const ZONES = ["North Zone", "South Zone", "East Zone", "West Zone", "Central Zone"];
const CATEGORIES = ["Water Supply", "Roads", "Electricity", "Sanitation", "Parks", "Public Works"];

export default async function NewComplaintPage() {
  const session = await requireSession();
  if (!["DEPARTMENT_MANAGER", "SUPERVISOR", "ADMINISTRATOR"].includes(session.role)) {
    redirect("/app/complaints");
  }
  const departments = await db.department.findMany({ orderBy: { name: "asc" } });

  const input = "w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200";
  const label = "mb-1.5 block text-sm font-medium text-slate-700";

  return (
    <>
      <PageHeader
        title="Manual Complaint Intake"
        subtitle="For phone-in and walk-in reports. Citizen-app complaints are ingested automatically via API."
      />
      <Card className="max-w-2xl">
        <form action={createComplaint} className="space-y-4">
          <div>
            <label className={label}>Complaint Title *</label>
            <input name="title" required placeholder="e.g. Burst pipe flooding 4th Cross street" className={input} />
          </div>
          <div>
            <label className={label}>Description</label>
            <textarea name="description" rows={4} placeholder="What was reported, by whom, and any location details…" className={input} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className={label}>Responsible Department *</label>
              <select name="departmentId" required className={input}>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>{d.name} (SLA {d.slaTarget}h)</option>
                ))}
              </select>
            </div>
            <div>
              <label className={label}>Category</label>
              <select name="category" className={input}>
                {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className={label}>Sub-category</label>
              <input name="subcategory" placeholder="e.g. Pipe Burst" className={input} />
            </div>
            <div>
              <label className={label}>Priority</label>
              <select name="priority" defaultValue="MEDIUM" className={input}>
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="CRITICAL">Critical</option>
              </select>
            </div>
            <div>
              <label className={label}>Zone</label>
              <select name="zone" className={input}>
                {ZONES.map((z) => <option key={z}>{z}</option>)}
              </select>
            </div>
            <div>
              <label className={label}>Address / Landmark</label>
              <input name="address" placeholder="e.g. Near Central Market gate 2" className={input} />
            </div>
          </div>
          <div className="flex items-center gap-3 pt-2">
            <button type="submit" className="rounded-lg bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-800">
              Create Complaint
            </button>
            <p className="text-xs text-slate-400">A CMP reference is generated automatically; the complaint enters Under Review.</p>
          </div>
        </form>
      </Card>
    </>
  );
}
