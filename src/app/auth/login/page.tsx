import Link from "next/link";
import { redirect } from "next/navigation";
import { Landmark, ShieldCheck } from "lucide-react";
import { getSession } from "@/lib/auth";
import { LoginForm } from "./login-form";

export const metadata = { title: "Staff Login" };

export default async function LoginPage() {
  const session = await getSession();
  if (session) redirect("/app/dashboard");

  return (
    <div className="flex min-h-screen">
      <div className="hidden w-1/2 flex-col justify-between bg-brand-950 p-12 text-white lg:flex">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10">
            <Landmark size={18} />
          </span>
          <span className="text-lg font-bold">LUMEN</span>
        </Link>
        <div>
          <h1 className="max-w-md text-3xl font-bold leading-tight">
            Operational command center for civic infrastructure
          </h1>
          <p className="mt-4 max-w-md text-brand-200/80">
            Sign in to manage complaints, coordinate field engineers, monitor assets and keep
            every department accountable — all from one screen.
          </p>
        </div>
        <p className="flex items-center gap-2 text-sm text-brand-300/70">
          <ShieldCheck size={16} /> Zero-trust access · Every action is audit-logged
        </p>
      </div>
      <div className="flex w-full items-center justify-center bg-slate-50 px-6 lg:w-1/2">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <h2 className="text-xl font-bold text-slate-900">Staff Sign In</h2>
          <p className="mb-6 mt-1 text-sm text-slate-500">
            Access is limited to authorized government personnel.
          </p>
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
