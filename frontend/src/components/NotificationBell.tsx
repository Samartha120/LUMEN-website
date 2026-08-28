import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Bell } from "lucide-react";
import { api } from "../lib/api";

type Note = {
  id: string;
  type: string;
  message: string;
  readAt: string | null;
  createdAt: string;
  complaint: { ref: string; title: string; status: string } | null;
};

/** "3 hours ago" — a timestamp is not what you want to read on a bell. */
function ago(iso: string): string {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const h = Math.round(mins / 60);
  if (h < 24) return `${h} hour${h === 1 ? "" : "s"} ago`;
  const d = Math.round(h / 24);
  return `${d} day${d === 1 ? "" : "s"} ago`;
}

export function NotificationBell() {
  const [items, setItems] = useState<Note[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  async function load() {
    try {
      const d = await api.get("/notifications");
      setItems(d.notifications ?? []);
      setUnread(d.unread ?? 0);
    } catch {
      /* a failed poll is not worth surfacing — the next one will succeed */
    }
  }

  useEffect(() => {
    load();
    // Polling rather than websockets: this is a municipal back-office, not a
    // chat app, and a minute of latency on "an engineer was assigned" costs
    // nothing while a socket server costs an always-on connection per user.
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, []);

  // Click outside to dismiss.
  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next && unread > 0) {
      // Opening the panel is the act of reading them.
      await api.post("/notifications/read", {}).catch(() => {});
      setUnread(0);
      setItems((cur) => cur.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })));
    }
  }

  return (
    <div className="relative" ref={box}>
      <button
        onClick={toggle}
        title={unread ? `${unread} unread` : "Notifications"}
        aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
        className="relative rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"
      >
        <Bell size={18} />
        {unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="surface surface-raised absolute right-0 z-40 mt-2 w-80 overflow-hidden rounded-xl">
          <div className="border-b border-slate-100 px-4 py-2.5">
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.09em] text-slate-500">Notifications</p>
          </div>
          {items.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-slate-400">Nothing yet.</p>
          ) : (
            <ul className="max-h-96 divide-y divide-slate-100 overflow-y-auto">
              {items.map((n) => (
                <li key={n.id}>
                  <Link
                    to={n.complaint ? `/app/complaints/${n.complaint.ref}` : "/app/complaints"}
                    onClick={() => setOpen(false)}
                    className="block px-4 py-3 transition hover:bg-slate-50"
                  >
                    <p className="text-sm leading-snug text-slate-700">{n.message}</p>
                    <p className="mt-1 text-xs text-slate-400">{ago(n.createdAt)}</p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
