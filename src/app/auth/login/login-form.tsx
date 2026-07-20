"use client";

import { useActionState, useState } from "react";
import { login, type LoginState } from "./actions";
import { Loader2 } from "lucide-react";

const DEMO_ACCOUNTS: [string, string][] = [
  ["Super Admin", "superadmin@lumen.gov"],
  ["Administrator", "admin@lumen.gov"],
  ["Commissioner", "commissioner@lumen.gov"],
  ["Dept. Manager", "manager@lumen.gov"],
  ["Supervisor", "supervisor@lumen.gov"],
  ["Engineer", "engineer@lumen.gov"],
  ["Analyst", "analyst@lumen.gov"],
  ["Auditor", "auditor@lumen.gov"],
];

export function LoginForm() {
  const [state, formAction, pending] = useActionState<LoginState, FormData>(login, {});
  const [email, setEmail] = useState("manager@lumen.gov");
  const [password, setPassword] = useState("lumen123");

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label className="mb-1.5 block text-sm font-medium text-slate-700">Official Email</label>
        <input
          name="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
          autoComplete="username"
        />
      </div>
      <div>
        <label className="mb-1.5 block text-sm font-medium text-slate-700">Password</label>
        <input
          name="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
          autoComplete="current-password"
        />
      </div>

      {state.error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-800 disabled:opacity-60"
      >
        {pending && <Loader2 size={16} className="animate-spin" />} Sign in to Command Center
      </button>

      <div className="pt-2">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">
          Demo accounts — password <span className="font-mono text-slate-500">lumen123</span>
        </p>
        <div className="flex flex-wrap gap-1.5">
          {DEMO_ACCOUNTS.map(([label, mail]) => (
            <button
              key={mail}
              type="button"
              onClick={() => { setEmail(mail); setPassword("lumen123"); }}
              className={`rounded-full border px-2.5 py-1 text-xs font-medium transition ${
                email === mail
                  ? "border-brand-600 bg-brand-50 text-brand-700"
                  : "border-slate-200 bg-white text-slate-600 hover:border-brand-300"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </form>
  );
}
