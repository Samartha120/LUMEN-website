export function Contact() {
  const cls = "w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200";
  return (
    <div className="mx-auto max-w-xl px-6 py-16">
      <h1 className="text-3xl font-bold tracking-tight text-slate-900">Contact Us</h1>
      <p className="mt-3 text-slate-600">For demos or partnership enquiries, reach out below.</p>
      <form className="mt-8 space-y-4" onSubmit={(e) => e.preventDefault()}>
        <div className="grid gap-4 sm:grid-cols-2">
          <input className={cls} placeholder="Full name" />
          <input className={cls} placeholder="Official email" type="email" />
        </div>
        <input className={cls} placeholder="Organization / Municipality" />
        <textarea className={cls + " h-32"} placeholder="How can we help?" />
        <button type="submit" className="rounded-lg bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-800">Send Message</button>
        <p className="text-xs text-slate-400">Demo form — submissions are not transmitted in this build.</p>
      </form>
    </div>
  );
}
