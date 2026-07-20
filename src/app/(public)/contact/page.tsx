export const metadata = { title: "Contact" };

export default function ContactPage() {
  return (
    <div className="mx-auto max-w-xl px-6 py-16">
      <h1 className="text-3xl font-bold tracking-tight text-slate-900">Contact Us</h1>
      <p className="mt-3 text-slate-600">
        For procurement enquiries, demos or partnership discussions, reach out below.
      </p>
      <form className="mt-8 space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <input className="rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200" placeholder="Full name" />
          <input className="rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200" placeholder="Official email" type="email" />
        </div>
        <input className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200" placeholder="Organization / Municipality" />
        <textarea className="h-32 w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200" placeholder="How can we help?" />
        <button type="button" className="rounded-lg bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-800">
          Send Message
        </button>
        <p className="text-xs text-slate-400">Demo form — submissions are not transmitted in this build.</p>
      </form>
    </div>
  );
}
