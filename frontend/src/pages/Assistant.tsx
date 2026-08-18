import { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { Send, Sparkles, User, Loader2, Database } from "lucide-react";
import { api } from "../lib/api";
import { PageHeader, Card } from "../components/ui";
import { PriorityBadge } from "../components/badges";

type Row = { ref: string; title: string; priority: string; category: string; status: string; severity: number };
type Stat = { label: string; value: string };
type Eng = { name: string; code: string; dept: string; zone: string; open: number; resolved: number; status: string };
type Reply = {
  answer: string; intent: string; confidence: number;
  rows?: Row[]; stats?: Stat[]; engineers?: Eng[]; suggestions?: string[];
  source?: "database" | "claude" | "ollama";
};
type Message =
  | { role: "user"; text: string }
  | { role: "assistant"; reply: Reply };

const OPENERS = [
  "How is the city doing?",
  "Which complaints have breached SLA?",
  "Show the 5 most severe complaints",
  "Who is the busiest engineer?",
  "What can we fix with 5 lakh?",
  "Complaints near the school",
];

export function Assistant() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, busy]);

  async function send(text: string) {
    const message = text.trim();
    if (!message || busy) return;
    setInput("");
    setError(null);
    setMessages((m) => [...m, { role: "user", text: message }]);
    setBusy(true);
    try {
      const reply = (await api.post("/assistant", { message })) as Reply;
      setMessages((m) => [...m, { role: "assistant", reply }]);
    } catch (e) {
      setError((e as Error).message || "The assistant is unavailable.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Operations Assistant"
        subtitle="Ask about the backlog in plain English · every figure comes from a live database query, shown beneath each answer"
      />

      <Card className="mt-1">
        <div className="flex min-h-[420px] flex-col">
          {/* ---- conversation ------------------------------------------- */}
          <div className="flex-1 space-y-4">
            {messages.length === 0 && (
              <div className="py-6 text-center">
                <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-indigo-50">
                  <Sparkles size={20} className="text-indigo-600" />
                </div>
                <p className="mt-3 text-sm font-medium text-slate-800">Ask about the complaint backlog</p>
                <p className="mx-auto mt-1 max-w-md text-xs text-slate-500">
                  This assistant queries the database directly rather than generating text about it,
                  so it cannot state a number the data does not support. Every answer shows its rows.
                </p>
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  {OPENERS.map((s) => (
                    <button key={s} onClick={() => send(s)}
                      className="rounded-full border border-slate-200 px-3 py-1.5 text-xs text-slate-600 transition hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700">
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m, i) =>
              m.role === "user" ? (
                <div key={i} className="flex justify-end">
                  <div className="flex max-w-[80%] items-start gap-2">
                    <p className="rounded-2xl rounded-tr-sm bg-indigo-600 px-3.5 py-2 text-sm text-white">{m.text}</p>
                    <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-200">
                      <User size={13} className="text-slate-600" />
                    </div>
                  </div>
                </div>
              ) : (
                <div key={i} className="flex items-start gap-2">
                  <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-100">
                    <Sparkles size={13} className="text-indigo-600" />
                  </div>
                  <div className="min-w-0 flex-1 space-y-2.5">
                    <div className="inline-block max-w-full rounded-2xl rounded-tl-sm bg-slate-100 px-3.5 py-2">
                      <p className="text-sm text-slate-800">{m.reply.answer}</p>
                    </div>

                    {/* what it understood, and which engine answered — the two
                        carry different guarantees, so the user is told which */}
                    {m.reply.source === "claude" || m.reply.source === "ollama" ? (
                      <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-amber-600">
                        <Sparkles size={10} />
                        {m.reply.source === "ollama" ? "Local model (Ollama)" : "Claude"}
                        {" · answered from a live snapshot, not a direct query"}
                      </p>
                    ) : (
                      <p className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-slate-400">
                        <Database size={10} />
                        {m.reply.intent}
                        {m.reply.intent !== "UNKNOWN" && ` · confidence ${(m.reply.confidence * 100).toFixed(0)}%`}
                      </p>
                    )}

                    {m.reply.stats && m.reply.stats.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {m.reply.stats.map((s) => (
                          <div key={s.label} className="rounded-lg border border-slate-200 px-2.5 py-1.5">
                            <p className="text-[10px] uppercase tracking-wide text-slate-500">{s.label}</p>
                            <p className="text-sm font-semibold text-slate-900">{s.value}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    {m.reply.rows && m.reply.rows.length > 0 && (
                      <div className="overflow-x-auto rounded-lg border border-slate-200">
                        <table className="w-full text-xs">
                          <thead className="bg-slate-50">
                            <tr className="text-left text-[10px] uppercase tracking-wide text-slate-500">
                              <th className="px-2.5 py-1.5">Ref</th>
                              <th className="px-2.5 py-1.5">Complaint</th>
                              <th className="px-2.5 py-1.5">Priority</th>
                              <th className="px-2.5 py-1.5">Severity</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {m.reply.rows.map((r) => (
                              <tr key={r.ref}>
                                <td className="px-2.5 py-1.5">
                                  <Link to={`/app/complaints/${r.ref}`} className="font-medium text-indigo-600 hover:underline">{r.ref}</Link>
                                </td>
                                <td className="max-w-[280px] truncate px-2.5 py-1.5 text-slate-700">{r.title}</td>
                                <td className="px-2.5 py-1.5"><PriorityBadge priority={r.priority} /></td>
                                <td className="px-2.5 py-1.5 text-slate-700">{r.severity}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {m.reply.engineers && m.reply.engineers.length > 0 && (
                      <div className="overflow-x-auto rounded-lg border border-slate-200">
                        <table className="w-full text-xs">
                          <thead className="bg-slate-50">
                            <tr className="text-left text-[10px] uppercase tracking-wide text-slate-500">
                              <th className="px-2.5 py-1.5">Engineer</th>
                              <th className="px-2.5 py-1.5">Department</th>
                              <th className="px-2.5 py-1.5">Open</th>
                              <th className="px-2.5 py-1.5">Resolved</th>
                              <th className="px-2.5 py-1.5">Status</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {m.reply.engineers.map((e) => (
                              <tr key={e.code}>
                                <td className="px-2.5 py-1.5">
                                  <span className="font-medium text-slate-800">{e.name}</span>
                                  <span className="ml-1.5 font-mono text-[10px] text-slate-400">{e.code}</span>
                                </td>
                                <td className="px-2.5 py-1.5 text-slate-600">{e.dept}</td>
                                <td className="px-2.5 py-1.5 font-medium text-slate-800">{e.open}</td>
                                <td className="px-2.5 py-1.5 text-slate-700">{e.resolved}</td>
                                <td className="px-2.5 py-1.5">
                                  <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                                    e.status === "AVAILABLE" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"
                                  }`}>
                                    {e.status === "AVAILABLE" ? "Available" : "Off duty"}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {m.reply.suggestions && m.reply.suggestions.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {m.reply.suggestions.map((s) => (
                          <button key={s} onClick={() => send(s)}
                            className="rounded-full border border-slate-200 px-2.5 py-1 text-[11px] text-slate-600 transition hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700">
                            {s}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ),
            )}

            {busy && (
              <div className="flex items-center gap-2 text-sm text-slate-400">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-100">
                  <Sparkles size={13} className="text-indigo-600" />
                </div>
                <Loader2 size={14} className="animate-spin" /> Querying…
              </div>
            )}
            <div ref={endRef} />
          </div>

          {error && <p className="mt-3 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

          {/* ---- composer ------------------------------------------------ */}
          <form
            onSubmit={(e) => { e.preventDefault(); send(input); }}
            className="mt-4 flex items-center gap-2 border-t border-slate-200 pt-4"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about complaints, SLA, engineers, budget…"
              maxLength={500}
              className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
            />
            <button
              type="submit"
              disabled={busy || !input.trim()}
              className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              <Send size={14} /> Ask
            </button>
          </form>
        </div>
      </Card>
    </>
  );
}
