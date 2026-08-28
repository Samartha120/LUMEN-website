/**
 * Feature 8b — language-model fallback for the operations assistant.
 *
 * The rule-based engine in assistant.ts answers the operations questions it
 * was built for, and it cannot state a figure the database does not support.
 * That guarantee is worth keeping, so this file does not replace it — it
 * catches what falls through. When classify() returns UNKNOWN, the question
 * is handed to Claude together with a snapshot of the live backlog, and the
 * answer is labelled so the user can see which engine produced it.
 *
 * Two properties this had to have:
 *
 *   Grounded.  The model is given the actual counts, the actual refs and the
 *              actual formulas, and is told to use them rather than invent
 *              figures. It cannot query the database itself.
 *
 *   Optional.  If ANTHROPIC_API_KEY is unset, the network is down, or the API
 *              errors, callLLM returns null and the caller keeps the local
 *              reply. The app works offline; the fallback is an upgrade, not
 *              a dependency.
 */
import Anthropic from "@anthropic-ai/sdk";
import type { PrismaClient } from "@prisma/client";
import { CATEGORIES, type CategoryKey } from "./taxonomy.js";
import { calculatePriority } from "./priority.js";

const MODEL = "claude-opus-5";
const OPEN_STATUSES = ["SUBMITTED", "ASSIGNED", "IN_PROGRESS", "PENDING_REVIEW"];

/** Constructed once. Null when no key is configured — that is a normal state. */
let client: Anthropic | null = null;
let checked = false;

function getClient(): Anthropic | null {
  if (!checked) {
    checked = true;
    const key = process.env.ANTHROPIC_API_KEY?.trim();
    if (key) client = new Anthropic({ apiKey: key, timeout: 30_000, maxRetries: 1 });
  }
  return client;
}

export const llmEnabled = () => getClient() !== null;

/**
 * How the platform works. This is static because it describes the code, not
 * the data — it lets the model answer "how does severity work?" or "what model
 * do you use?" accurately instead of guessing at a plausible-sounding formula.
 */
const SYSTEM_FACTS = `
LUMEN is an AI-assisted civic damage reporting platform. Architecture:
  - Frontend: Vite + React SPA (port 5173)
  - Backend:  Express + Prisma REST API over SQLite (port 4000)
  - AI:       FastAPI computer-vision service (port 8100)

Detection: three classes across three categories — Pothole (Roads), Garbage
Pile (Waste), Open Manhole (Water). Two further classes, Alligator Crack and
Overflowing Bin, were trained and then withdrawn: on held-out data they scored
precision 0.639 / recall 0.225 and precision 0.500 / recall 0.444, so they are
suppressed rather than shown to a supervisor. Do not offer them.

Potholes come from a YOLO11s fine-tuned on LUMEN-domain images; Open Manhole
from a dedicated detector held at a 0.55 confidence floor, measured to separate
real manholes (0.56-0.84) from everything else (never above 0.32). Detection
runs on the whole frame first, then on an overlapping 4x3 tile grid for small
objects. A COCO-pretrained model runs alongside purely as an exclusion filter,
so cars and pedestrians are never boxed as damage. Uploads with no civic
content are rejected by a Places365 scene classifier.

Outlines: potholes and manholes are drawn as polygons rather than rectangles.
The manhole outline comes from a YOLO11s-seg fine-tune whose training polygons
were generated semi-automatically with MobileSAM and filtered by a shape gate
(held-out mask precision 0.858, recall 0.788, mAP50 0.881). It only traces
boxes the detector already committed to; it never decides that a manhole is
present. Where an outline cannot be trusted the detection keeps its rectangle.

Severity score = 100 x sum over detections of (class weight x sqrt(area) x confidence).

Priority score starts from severity and adds points for: proximity to a
landmark (hospital, school, highway) within 500 m, duplicate reports of the
same issue, how long the complaint has been waiting, and the risk weight of
the responsible department. It is recomputed on every read because it ages.

Duplicate detection: ResNet-18 512-dimension image embeddings compared by
cosine similarity, combined with Haversine distance between the two reports.

Assignment: complaints route to a department by detected category, then to an
engineer by the Hungarian (Kuhn-Munkres) algorithm, minimising a cost of
travel distance + skill mismatch + current workload - severity. It is compared
on screen against a greedy nearest-engineer baseline, which it beats by around
40% on cost and travel.

Site measurements and material estimate: an engineer records each pothole's
length, width and depth in metres. Volume is length x width x depth, perimeter
is 2 x (length + width). Those feed a bill of quantities - brick aggregate,
sand, bitumen, water and additive for a bituminous road; cement, sand, coarse
aggregate and water at the nominal 1:2:4 (M20) mix for a concrete road - plus
a wastage allowance, indicative rupee rates, labour at 25% of materials and
contractor overhead at 15%. Dimensions can also be estimated from the
photograph itself, which is always labelled ESTIMATED rather than MEASURED,
because a single uncalibrated photo carries no true scale.

Budget planner: given a budget, 0/1 knapsack by dynamic programming chooses
which repairs remove the most public risk, and Clarke-Wright savings plus
2-opt orders each crew's route. It reports what deferring the unfunded work
costs as those complaints age.
`.trim();

/**
 * A compact, current picture of the backlog for the model to reason over.
 * Exported so it can be printed and checked — a wrong snapshot would produce
 * confidently wrong answers, and that failure is invisible from the outside.
 */
export async function snapshot(db: PrismaClient): Promise<string> {
  const open = { status: { in: OPEN_STATUSES }, duplicateOfId: null };

  const [raw, byStatus, engineers, closed] = await Promise.all([
    db.complaint.findMany({
      where: open,
      select: {
        ref: true, title: true, status: true, category: true, civicCategory: true,
        lat: true, lng: true, severityScore: true, aiConfidence: true,
        slaHours: true, priorityFactors: true, createdAt: true,
      },
    }),
    db.complaint.groupBy({ by: ["status"], where: { duplicateOfId: null }, _count: true }),
    db.engineer.findMany({
      include: {
        complaints: { where: { status: { in: ["ASSIGNED", "IN_PROGRESS"] } }, select: { id: true } },
        department: true,
      },
    }),
    db.complaint.count({ where: { status: "CLOSED" } }),
  ]);

  // Priority ages, so the stored column goes stale. The rest of the app
  // recomputes it on every read — this must too, or the model would quote a
  // different critical count than the dashboard shows.
  const all = raw.map((c) => {
    let nearbyReports = 0;
    try { nearbyReports = Number(JSON.parse(c.priorityFactors ?? "{}").duplicateReports ?? 0); } catch { /* legacy rows */ }
    const p = calculatePriority({
      severityScore: c.severityScore ?? 0, confidence: c.aiConfidence ?? 0,
      categoryLabel: c.category, lat: c.lat, lng: c.lng, nearbyReports, createdAt: c.createdAt,
    });
    return { ...c, priority: p.priority, priorityScore: p.score };
  });

  const tally = (key: (c: (typeof all)[number]) => string | null) => {
    const m = new Map<string, number>();
    for (const c of all) {
      const k = key(c);
      if (k) m.set(k, (m.get(k) ?? 0) + 1);
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k}=${n}`).join(", ") || "none";
  };

  const now = Date.now();
  // 48 h is the default the SLA handler uses; keep the two in step.
  const breached = all.filter(
    (c) => (now - c.createdAt.getTime()) / 3_600_000 > (c.slaHours ?? 48),
  ).length;

  const severe = [...all]
    .sort((a, b) => b.priorityScore - a.priorityScore)
    .slice(0, 8);

  const workload = engineers
    .map(
      (e) =>
        `${e.name} (${e.code}, ${e.department?.name ?? "unassigned dept"}, zone ${e.zone}, ${e.status}): ` +
        `${e.complaints.length} open, ${e.resolvedJobs} resolved all-time`,
    )
    .sort();

  // Comparisons the model gets wrong if left to work them out itself. Asked
  // who to worry about, an 8B model scanned the roster and named engineers
  // with 3 and 7 open jobs while ignoring the one with 9. The numbers it
  // quoted were real — it just compared them badly. So the comparisons are
  // done here, in code, and handed over as conclusions.
  const byLoad = [...engineers].sort((a, b) => b.complaints.length - a.complaints.length);
  const busiest = byLoad[0];
  const idle = engineers.filter((e) => e.complaints.length === 0 && e.status === "AVAILABLE");
  const oldest = [...all].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())[0];
  const topCategory = (() => {
    const m = new Map<string, number>();
    for (const c of all) {
      const k = c.civicCategory ? CATEGORIES[c.civicCategory as CategoryKey]?.label ?? c.civicCategory : null;
      if (k) m.set(k, (m.get(k) ?? 0) + 1);
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1])[0];
  })();

  const derived = [
    busiest ? `Busiest engineer: ${busiest.name} (${busiest.code}) with ${busiest.complaints.length} open jobs — more than anyone else.` : null,
    idle.length ? `Available with nothing assigned: ${idle.map((e) => e.name).join(", ")}.` : "Every available engineer has at least one job.",
    all.length ? `Single highest-priority complaint right now: ${severe[0].ref} (${severe[0].priority}, priority ${Math.round(severe[0].priorityScore)}).` : null,
    oldest ? `Longest-waiting open complaint: ${oldest.ref}, opened ${Math.floor((now - oldest.createdAt.getTime()) / 86_400_000)} days ago.` : null,
    topCategory ? `Largest category: ${topCategory[0]} with ${topCategory[1]} open.` : null,
  ].filter(Boolean) as string[];

  return [
    `Open complaints: ${all.length}. Closed to date: ${closed}. Open and past SLA: ${breached}.`,
    `Open by priority: ${tally((c) => c.priority)}`,
    `Open by category: ${tally((c) => (c.civicCategory ? CATEGORIES[c.civicCategory as CategoryKey]?.label ?? c.civicCategory : null))}`,
    `All complaints by status: ${byStatus.map((s) => `${s.status}=${s._count}`).join(", ")}`,
    "",
    "Highest-priority open complaints:",
    ...severe.map(
      (c) =>
        `  ${c.ref} — ${c.title} [${c.priority}, ${c.status}, priority ${Math.round(c.priorityScore)}, severity ${Math.round((c.severityScore ?? 0) * 10) / 10}]`,
    ),
    "",
    "Engineers:",
    ...workload.map((w) => `  ${w}`),
    "",
    "ALREADY WORKED OUT FOR YOU — use these directly, do not recompute:",
    ...derived.map((d) => `  ${d}`),
  ].join("\n");
}

const SYSTEM_PROMPT = `
You are the operations assistant for LUMEN, a civic damage reporting platform
used by municipal supervisors and engineers.

A rule-based query engine handles the common operational questions. You are
handling a question it could not parse, so the user is likely asking something
broader, more conversational, or outside the usual reporting vocabulary.

Rules:
- Every figure about complaints, engineers or the backlog must come from the
  LIVE DATA block. Never estimate, extrapolate or invent a number. If the data
  needed is not in that block, say plainly what you cannot see and suggest the
  question that would get it.
- Questions about how the platform works are answered from the SYSTEM FACTS
  block.
- General questions unrelated to LUMEN (how an algorithm works, what a term
  means) you may answer from your own knowledge. Say when you are doing that.
- Complaint references look like CMP-10250. Cite them when relevant.
- Refer to engineers by name or code. Never use "he" or "she" for them — the
  records hold no such information and guessing it from a name is wrong as
  often as it is right. Use "they", or repeat the name.
- Be brief: two or three sentences for most questions. No headings, no bullet
  lists unless you are genuinely enumerating things. Plain prose.
- This is a live operations tool. Do not speculate about the state of the city
  beyond what the data shows.
`.trim();

/**
 * Ollama — a model running on this machine, over HTTP on :11434.
 *
 * This is the default provider because it costs nothing and needs no account,
 * which matters for a student project. It is a smaller model than Claude and
 * reasons less well, but the grounding does the heavy lifting: the figures it
 * quotes come from the snapshot, so the answers stay factual even when the
 * commentary around them is plain.
 */
/**
 * Extra rules for the local model only.
 *
 * The shared prompt asks for brevity and Claude obliges. Llama 3 does not — it
 * opens with "I'm happy to help you with that!", hedges about not being an
 * expert, and then runs past the token limit and stops mid-sentence. These
 * rules are blunter and repeated because that is what the smaller model
 * responds to, and shorter output is also faster output.
 */
const OLLAMA_EXTRA = `
STRICT OUTPUT RULES — follow these exactly:
- Maximum 3 sentences. Shorter is better.
- Start with the answer. No greeting, no "I'm happy to help", no "Great question".
- Never say you are not an expert, not a data analyst, or not a developer. You
  are the operations assistant and the data above is yours to report.
- No bullet points, no headings, no closing offer of further help.
- NEVER write "he", "she", "his" or "her" about an engineer. Write the person's
  name again, or "they". The same rule in the main prompt is ignored by this
  model, which is why it is repeated here.
`.trim();

async function askOllama(context: string, question: string): Promise<string | null> {
  const url = process.env.OLLAMA_URL ?? "http://localhost:11434";
  const model = process.env.OLLAMA_MODEL ?? "llama3";

  // A local model on a laptop is slower than an API and the first call also
  // pays to load weights into memory. Generous, but bounded — a hung request
  // must not leave the user staring at a spinner.
  const res = await fetch(`${url}/api/chat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      model,
      stream: false,
      // Low temperature: this is factual reporting, not writing.
      options: { temperature: 0.2, num_predict: 200 },
      messages: [
        { role: "system", content: `${SYSTEM_PROMPT}\n${OLLAMA_EXTRA}` },
        { role: "user", content: `${context}\n\nQuestion: ${question}` },
      ],
    }),
    signal: AbortSignal.timeout(60_000),
  });

  if (!res.ok) throw new Error(`Ollama HTTP ${res.status}`);
  const body = (await res.json()) as { message?: { content?: string } };
  return body.message?.content?.trim() || null;
}

/**
 * Claude — used only when an API key is configured and funded. Better at the
 * open-ended questions, so it takes precedence when available.
 */
async function askClaude(context: string, question: string): Promise<string | null> {
  const anthropic = getClient();
  if (!anthropic) return null;

  {
    const body = {
      model: MODEL,
      max_tokens: 1024,
      system: SYSTEM_PROMPT,
      // Low effort: this is a short grounded answer in an interactive chat, so
      // latency matters more than depth. Thinking stays on — disabling it on
      // this model risks reasoning leaking into the visible reply.
      thinking: { type: "adaptive" as const },
      output_config: { effort: "low" as const },
      messages: [{ role: "user" as const, content: `${context}\n\nQuestion: ${question}` }],
    };

    // Both call shapes return the same message envelope; the SDK's beta
    // signature is a union that also covers streaming, which this never uses.
    type Reply = { stop_reason: string | null; content: { type: string; text?: string }[] };

    let msg: Reply;
    try {
      // Server-side fallback: if a safety classifier declines the request, the
      // API re-runs it on a fallback model rather than returning nothing.
      msg = (await anthropic.beta.messages.create({
        ...body,
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any)) as Reply;
    } catch (e) {
      // Retry plainly only when the beta itself was the problem. Any other 400
      // — no credit, bad payload — would fail identically the second time, and
      // retrying just doubles the latency the user waits before seeing the
      // local reply.
      const msg400 = e instanceof Anthropic.BadRequestError ? String(e.message) : "";
      if (!/fallback|beta/i.test(msg400)) throw e;
      msg = (await anthropic.messages.create(body)) as Reply;
    }

    // A safety classifier declined; fall back to the local reply rather than
    // showing an empty bubble.
    if (msg.stop_reason === "refusal") return null;

    const text = msg.content
      .filter((b) => b.type === "text")
      .map((b) => b.text ?? "")
      .join("")
      .trim();

    return text || null;
  }
}

/** Which engine actually produced an answer, for labelling in the UI. */
export type LlmSource = "claude" | "ollama";

/**
 * Ask whichever language model is available, grounded on the live backlog.
 *
 * Claude first when a key is configured, Ollama otherwise — and if the
 * preferred one fails for any reason (no credit, offline, model not pulled),
 * the next is tried. When they all fail this returns null and the caller
 * shows its own local reply, so the assistant never breaks; it only loses
 * the open-ended answers.
 */
export async function callLLM(
  db: PrismaClient,
  question: string,
  /** Extra source material — e.g. the canned explanation the question skirted. */
  extra?: string,
): Promise<{ text: string; source: LlmSource } | null> {
  const providers: { name: LlmSource; run: (c: string, q: string) => Promise<string | null> }[] =
    getClient() ? [{ name: "claude", run: askClaude }, { name: "ollama", run: askOllama }]
                : [{ name: "ollama", run: askOllama }];

  let context: string;
  try {
    context =
      `SYSTEM FACTS\n${SYSTEM_FACTS}\n\nLIVE DATA (queried just now)\n${await snapshot(db)}` +
      (extra ? `\n\nRELEVANT PLATFORM DETAIL\n${extra}` : "");
  } catch (e) {
    console.warn(`[assistant] could not build snapshot: ${(e as Error).message}`);
    return null;
  }

  for (const p of providers) {
    try {
      const text = await p.run(context, question);
      if (text) return { text, source: p.name };
    } catch (e) {
      // Offline, no quota, bad key, timeout — try the next one.
      console.warn(`[assistant] ${p.name} unavailable: ${(e as Error).message}`);
    }
  }
  return null;
}
