/**
 * Feature 8 — operations assistant.
 *
 * A natural-language query interface over the complaint database. A supervisor
 * asks "which complaints have breached SLA near the school?" and gets an
 * answer with the actual rows behind it.
 *
 * Design decision worth stating plainly: this is a grounded query engine, not
 * a language model. Every number in every answer is produced by a database
 * query executed after the question is parsed, and the rows are returned
 * alongside the answer so the user can check them. That makes it impossible
 * for the assistant to state a figure the data does not support — the failure
 * mode of a generative model answering questions about private data. The cost
 * of that guarantee is coverage: it understands the operations domain it was
 * built for, and says so when a question falls outside it.
 *
 * Pipeline:  normalise -> extract entities -> score intents -> execute -> render
 */
import type { PrismaClient } from "@prisma/client";
import { CATEGORIES, type CategoryKey } from "./taxonomy.js";
import { calculatePriority } from "./priority.js";
import { haversineMeters } from "./geo.js";
import { callLLM } from "./llm.js";

// ---------------------------------------------------------------------------
// Text normalisation and fuzzy matching
// ---------------------------------------------------------------------------

const STOPWORDS = new Set([
  "the", "a", "an", "is", "are", "was", "were", "of", "in", "on", "at", "to", "for",
  "me", "my", "we", "our", "you", "please", "show", "give", "tell", "can", "could",
  "would", "do", "does", "did", "and", "or", "with", "from", "that", "this", "there",
  "it", "be", "have", "has", "had", "i", "am", "any", "all",
  // Currency units — they sit next to numbers and must never be read as
  // domain vocabulary. Amounts are parsed by regex, not by token matching.
  "lakh", "lakhs", "lac", "lacs", "crore", "crores", "rs", "rupees", "inr",
]);

function normalise(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9\s.-]/g, " ").replace(/\s+/g, " ").trim();
}

function tokens(text: string): string[] {
  return normalise(text).split(" ").filter((t) => t && !STOPWORDS.has(t));
}

/**
 * Damerau–Levenshtein (optimal string alignment) distance.
 *
 * Plain Levenshtein is not selective enough here. It scores "hgih" -> "high"
 * and "lakh" -> "leak" both at 2, but only the first is a typo — the second is
 * a different word, and treating it as a match made "5 lakh" filter the query
 * to Water complaints. Counting a transposition as one operation separates
 * them: "hgih" -> "high" is 1, "lakh" -> "leak" stays 2.
 */
function editDistance(a: string, b: string): number {
  if (Math.abs(a.length - b.length) > 3) return 99;
  const d: number[][] = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) d[i][0] = i;
  for (let j = 0; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1); // transposition
      }
    }
  }
  return d[a.length][b.length];
}

/**
 * Match a token against a vocabulary, tolerating minor misspellings.
 * The tolerance scales with word length — one edit in a short word changes it
 * into a genuinely different word far more often than one edit in a long one.
 */
function fuzzyFind(token: string, vocab: string[]): string | null {
  for (const v of vocab) if (v === token) return v;
  if (token.length < 4) return null;
  // Two edits only for genuinely long words. At seven letters it was enough to
  // turn "weather" into "water", which filed a question about the sky under
  // the Water category and stopped it ever reaching the fallback. One edit
  // still absorbs the real typos ("potohle", "garbge", "drainge").
  const limit = token.length <= 7 ? 1 : 2;
  let best: string | null = null;
  let bestD = limit + 1;
  for (const v of vocab) {
    const d = editDistance(token, v);
    if (d < bestD) { bestD = d; best = v; }
  }
  return bestD <= limit ? best : null;
}

// ---------------------------------------------------------------------------
// Entity extraction
// ---------------------------------------------------------------------------

const PRIORITIES = ["low", "medium", "high", "critical"];
const STATUSES: Record<string, string> = {
  open: "OPEN", submitted: "SUBMITTED", new: "SUBMITTED", unassigned: "SUBMITTED",
  assigned: "ASSIGNED", progress: "IN_PROGRESS", ongoing: "IN_PROGRESS",
  review: "PENDING_REVIEW", pending: "PENDING_REVIEW",
  closed: "CLOSED", done: "CLOSED", resolved: "CLOSED", finished: "CLOSED",
};
const CATEGORY_WORDS: Record<string, CategoryKey> = {
  road: "ROADS", roads: "ROADS", pothole: "ROADS", potholes: "ROADS", crack: "ROADS",
  waste: "WASTE", garbage: "WASTE", trash: "WASTE", sanitation: "WASTE", bin: "WASTE",
  water: "WATER", manhole: "WATER", drainage: "WATER",
};
const LANDMARK_WORDS: Record<string, string> = {
  hospital: "Hospital", clinic: "Hospital", school: "School", college: "School",
  highway: "Major highway", road: "Major highway",
};

export type Entities = {
  priority?: string;
  status?: string;
  category?: CategoryKey;
  landmark?: string;
  ref?: string;
  limit?: number;
  budget?: number;
  days?: number;
  topic?: string;
};

/** First explainable topic named in the text, if any. */
function topicOf(norm: string): string | null {
  for (const t of norm.split(" ")) {
    const hit = TOPIC_WORDS[t] ?? (t.length >= 4 ? TOPIC_WORDS[fuzzyFind(t, Object.keys(TOPIC_WORDS)) ?? ""] : undefined);
    if (hit) return hit;
  }
  return null;
}

export function extract(text: string): Entities {
  const e: Entities = {};
  const norm = normalise(text);
  const toks = tokens(text);

  const ref = text.toUpperCase().match(/CMP-?\s?(\d{4,6})/);
  if (ref) e.ref = `CMP-${ref[1]}`;

  for (const t of toks) {
    if (!e.priority) {
      const p = fuzzyFind(t, PRIORITIES);
      if (p) { e.priority = p.toUpperCase(); continue; }
    }
    if (!e.status) {
      const s = fuzzyFind(t, Object.keys(STATUSES));
      if (s) { e.status = STATUSES[s]; continue; }
    }
    if (!e.category) {
      const c = fuzzyFind(t, Object.keys(CATEGORY_WORDS));
      if (c) { e.category = CATEGORY_WORDS[c]; continue; }
    }
    if (!e.landmark) {
      const l = LANDMARK_WORDS[t];
      // "road" is a category word too; only treat it as a landmark alongside "near".
      if (l && (t !== "road" || /near|around|close/.test(norm))) e.landmark = l;
    }
  }

  // Allows "top 5", "show the 5 most severe", "list 10", "5 complaints".
  const top =
    norm.match(/(?:top|first|last|show|list|give)\s+(?:me\s+)?(?:the\s+)?(\d{1,3})/) ??
    norm.match(/\b(\d{1,3})\s+(?:most\s+\w+\s+)?complaints?\b/);
  if (top) e.limit = Math.min(50, Math.max(1, parseInt(top[1], 10)));

  // Budget: "5 lakh", "500000", "2.5L", "50k"
  const lakh = norm.match(/(\d+(?:\.\d+)?)\s*(?:lakh|lac|l\b)/);
  const kay = norm.match(/(\d+(?:\.\d+)?)\s*k\b/);
  const crore = norm.match(/(\d+(?:\.\d+)?)\s*crore/);
  const plain = norm.match(/(?:rs\.?|budget of|with)\s*(\d{4,9})/);
  if (crore) e.budget = Math.round(parseFloat(crore[1]) * 10_000_000);
  else if (lakh) e.budget = Math.round(parseFloat(lakh[1]) * 100_000);
  else if (kay) e.budget = Math.round(parseFloat(kay[1]) * 1_000);
  else if (plain) e.budget = parseInt(plain[1], 10);

  const days = norm.match(/(\d{1,3})\s*(?:day|days)/);
  if (days) e.days = Math.min(365, parseInt(days[1], 10));
  if (/\bweek\b/.test(norm)) e.days = e.days ?? 7;
  if (/\bmonth\b/.test(norm)) e.days = e.days ?? 30;
  if (/\btoday\b/.test(norm)) e.days = e.days ?? 1;

  const topic = topicOf(norm);
  if (topic) e.topic = topic;

  return e;
}

// ---------------------------------------------------------------------------
// Intent classification
// ---------------------------------------------------------------------------

export type Intent =
  | "COUNT" | "LIST" | "SLA_BREACH" | "ENGINEER_LOAD" | "BREAKDOWN"
  | "DUPLICATES" | "LOOKUP" | "BUDGET" | "NEAR" | "OVERVIEW"
  | "WHY" | "EXPLAIN" | "HELP" | "UNKNOWN";

/**
 * Topics the assistant can explain about its own workings. Keyed by the words
 * a user would actually type.
 */
const TOPIC_WORDS: Record<string, string> = {
  priority: "priority", priorities: "priority", urgent: "priority", ranking: "priority",
  severity: "severity", score: "severity", scoring: "severity",
  duplicate: "duplicate", duplicates: "duplicate", deduplication: "duplicate",
  sla: "sla", deadline: "sla", target: "sla",
  routing: "routing", routed: "routing", department: "routing", departments: "routing",
  assignment: "assignment", assigned: "assignment", assigning: "assignment", assign: "assignment", optimiser: "assignment", dispatch: "assignment", hungarian: "assignment",
  budget: "budget", knapsack: "budget", planner: "budget", funding: "budget",
  detection: "detection", detect: "detection", model: "detection", yolo: "detection", ai: "detection",
  material: "material", materials: "material", estimate: "material", boq: "material",
  cement: "material", bitumen: "material", quantities: "material", measurement: "material", measurements: "material",
};

/** Weighted cue phrases per intent. Multi-word cues score higher than single
 *  words, so "how many" beats an incidental "many". */
const CUES: Record<Exclude<Intent, "UNKNOWN">, [string, number][]> = {
  COUNT:         [["how many", 5], ["count", 4], ["number of", 4], ["total", 2]],
  LIST:          [["list", 4], ["show", 3], ["which complaints", 5], ["top", 3], ["worst", 4], ["most severe", 5], ["give", 2]],
  SLA_BREACH:    [["sla", 5], ["breach", 5], ["overdue", 5], ["late", 4], ["deadline", 4], ["missed", 3]],
  ENGINEER_LOAD: [["engineer", 4], ["engineers", 4], ["workload", 5], ["who has", 4], ["who is", 3], ["busiest", 5], ["staff", 3], ["crew", 3], ["assigned to", 3], ["team", 3]],
  BREAKDOWN:     [["breakdown", 5], ["by category", 5], ["by department", 5], ["distribution", 4], ["split", 3], ["per category", 5]],
  DUPLICATES:    [["duplicate", 5], ["duplicates", 5], ["repeated", 4], ["same complaint", 4]],
  LOOKUP:        [["status of", 5], ["tell me about", 4], ["details", 3], ["what happened", 4], ["where is", 4], ["where has", 4], ["track", 4], ["my complaint", 3], ["update on", 4]],
  WHY:           [["why", 4], ["still pending", 5], ["still open", 5], ["still not", 5], ["not fixed", 5], ["taking so long", 5], ["delay", 4], ["delayed", 4], ["hold up", 4], ["waiting", 3]],
  EXPLAIN:       [["how is", 3], ["how does", 3], ["how do you", 4], ["how are", 3], ["explain", 5], ["calculated", 4], ["computed", 4], ["formula", 5], ["what is", 2], ["work out", 3], ["decide", 3]],
  BUDGET:        [["budget", 5], ["afford", 5], ["fix with", 5], ["spend", 4], ["cost", 3], ["plan", 3], ["lakh", 4], ["crore", 4]],
  NEAR:          [["near", 4], ["around", 3], ["close to", 4], ["nearby", 4], ["within", 3]],
  OVERVIEW:      [["overview", 5], ["summary", 5], ["how are we", 5], ["how is the city", 5], ["status report", 5], ["dashboard", 3], ["doing", 3]],
  HELP:          [["help", 5], ["what can you", 5], ["how do i use", 5], ["capabilities", 4], ["examples", 3]],
};

/**
 * Cue matchers, compiled once.
 *
 * Two failures to avoid, pulling in opposite directions:
 *   - Bare substring matching made "calculated" contain the SLA cue "late", so
 *     "how is priority calculated" returned the overdue list. Hence the leading
 *     \b — a cue must start at a word boundary, and "calculated" has none
 *     before its "late".
 *   - A bare trailing \b then broke the reverse case: "breach" stopped matching
 *     "breached" and "duplicate" stopped matching "duplicates". Hence the small
 *     closed set of inflectional suffixes, which admits those without admitting
 *     unrelated words ("sla" still does not match "slab").
 */
const CUE_RE: [Intent, RegExp, number][] = (Object.entries(CUES) as [Intent, [string, number][]][])
  .flatMap(([intent, cues]) =>
    cues.map(([cue, weight]) =>
      [
        intent,
        new RegExp(`\\b${cue.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:s|es|ed|d|ing)?\\b`),
        weight,
      ] as [Intent, RegExp, number],
    ),
  );

export function classify(text: string, e: Entities): { intent: Intent; confidence: number } {
  const norm = normalise(text);
  const scores = new Map<Intent, number>();

  for (const [intent, re, weight] of CUE_RE) {
    if (re.test(norm)) scores.set(intent, (scores.get(intent) ?? 0) + weight);
  }

  // An explain-style question only counts as EXPLAIN if it names something
  // the assistant can actually explain; otherwise "what is the worst one"
  // would be treated as a request for documentation.
  const topic = topicOf(norm);
  if (topic && scores.has("EXPLAIN")) scores.set("EXPLAIN", scores.get("EXPLAIN")! + 6);
  else scores.delete("EXPLAIN");

  // "Why is CMP-10250 pending" is a WHY question about one complaint, not a
  // plain record lookup — WHY needs to outrank the reference bonus below.
  if (scores.has("WHY") && e.ref) scores.set("WHY", scores.get("WHY")! + 5);

  // Entity presence is evidence for particular intents.
  if (e.ref) scores.set("LOOKUP", (scores.get("LOOKUP") ?? 0) + 6);
  if (e.budget) scores.set("BUDGET", (scores.get("BUDGET") ?? 0) + 5);
  if (e.landmark) scores.set("NEAR", (scores.get("NEAR") ?? 0) + 4);

  // "how many ... near the school" is a count, not a list — COUNT outranks NEAR
  // when both fire, but NEAR still contributes its filter downstream.
  if (scores.has("COUNT") && scores.has("NEAR")) scores.set("COUNT", scores.get("COUNT")! + 2);

  // "How many duplicates are there" reads as a COUNT, but the DUPLICATES
  // handler already answers with a count and explains the linking rule, so it
  // is the better response to the same question.
  if (scores.has("DUPLICATES") && scores.has("COUNT")) scores.set("DUPLICATES", scores.get("DUPLICATES")! + 3);

  // People do not call it a "complaint". They ask after their request, issue,
  // case, ticket or report — and often without any reference number, because
  // they do not have it to hand. Any first-person mention of a case is a
  // lookup; the handler then asks for the reference rather than shrugging.
  if (/\b(my|our|the)\s+(complaint|request|issue|case|ticket|report|job|grievance|application)\b/.test(norm)) {
    scores.set("LOOKUP", (scores.get("LOOKUP") ?? 0) + 6);
  }

  // A question that names people is about people, whatever else it contains.
  // "Who is the worst engineer" scores for LIST too, because "worst" is how
  // one asks for the bottom of a complaint ranking — and LIST used to win the
  // tie and answer with complaints. Naming staff is the stronger signal.
  if (scores.has("ENGINEER_LOAD") && /\b(engineers?|staff|crew|team)\b/.test(norm)) {
    scores.set("ENGINEER_LOAD", scores.get("ENGINEER_LOAD")! + 5);
  }

  // "How do you assign engineers" is a question about the method, not about
  // who is busy. When the phrasing plainly asks for an explanation and a known
  // topic is named, EXPLAIN outranks whatever else the nouns matched.
  if (e.topic && /\b(how (do|does|is|are)|explain|what is the (formula|method|algorithm)|why do)\b/.test(norm)) {
    scores.set("EXPLAIN", (scores.get("EXPLAIN") ?? 0) + 7);
  }

  if (scores.size === 0) {
    // A bare filter with no verb ("critical water complaints") is a list request.
    if (e.priority || e.status || e.category) return { intent: "LIST", confidence: 0.5 };
    return { intent: "UNKNOWN", confidence: 0 };
  }

  const ranked = [...scores.entries()].sort((a, b) => b[1] - a[1]);
  const [intent, top] = ranked[0];
  const second = ranked[1]?.[1] ?? 0;
  // Confidence reflects both absolute score and margin over the runner-up.
  const confidence = Math.min(1, (top / 10) * 0.6 + ((top - second) / Math.max(1, top)) * 0.4);
  return { intent, confidence: Math.round(confidence * 100) / 100 };
}

// ---------------------------------------------------------------------------
// Execution
// ---------------------------------------------------------------------------

export type Answer = {
  answer: string;
  intent: Intent;
  confidence: number;
  entities: Entities;
  /** Rows the answer was computed from, so the user can verify it. */
  rows?: { ref: string; title: string; priority: string; category: string; status: string; severity: number }[];
  stats?: { label: string; value: string }[];
  /** Full roster, when the question was about staff rather than complaints. */
  engineers?: { name: string; code: string; dept: string; zone: string; open: number; resolved: number; status: string }[];
  suggestions?: string[];
  /**
   * Which engine produced the answer. "database" means every figure came from
   * a query and the rows are shown; "claude" means a language model answered
   * from a supplied snapshot. Surfaced in the UI because the two carry
   * different guarantees and the user should not have to guess which is which.
   */
  source?: "database" | "claude" | "ollama";
};

const OPEN_STATUSES = ["SUBMITTED", "ASSIGNED", "IN_PROGRESS", "PENDING_REVIEW"];

const LANDMARKS: Record<string, { lat: number; lng: number }> = {
  "Hospital": { lat: 12.9719, lng: 77.5937 },
  "School": { lat: 12.9352, lng: 77.6245 },
  "Major highway": { lat: 12.957, lng: 77.639 },
};

const plural = (n: number, one: string, many = one + "s") => `${n} ${n === 1 ? one : many}`;
const rupees = (n: number) => `₹${n.toLocaleString("en-IN")}`;

function whereFrom(e: Entities): Record<string, unknown> {
  const where: Record<string, unknown> = { duplicateOfId: null };
  if (e.status === "OPEN") where.status = { in: OPEN_STATUSES };
  else if (e.status) where.status = e.status;
  else where.status = { in: OPEN_STATUSES };
  if (e.category) where.civicCategory = e.category;
  return where;
}

/** Describe the filters in words, so the answer states what it actually counted. */
function filterPhrase(e: Entities): string {
  const bits: string[] = [];
  if (e.priority) bits.push(e.priority.toLowerCase());
  if (e.category) bits.push(CATEGORIES[e.category].label.toLowerCase());
  const noun = bits.length ? `${bits.join(" ")} complaints` : "complaints";
  const state = e.status && e.status !== "OPEN" ? e.status.toLowerCase().replace("_", " ") : "open";
  return `${state} ${noun}`;
}

type Row = Answer["rows"] extends (infer R)[] | undefined ? R : never;

function toRows(list: Array<{ ref: string; title: string; priority: string; category: string; status: string; severityScore: number | null }>): Row[] {
  return list.map((c) => ({
    ref: c.ref, title: c.title, priority: c.priority, category: c.category,
    status: c.status, severity: Math.round((c.severityScore ?? 0) * 10) / 10,
  }));
}

/** Recompute live priority — it ages, so a stored value would misreport. */
async function livePriority(db: PrismaClient, where: Record<string, unknown>) {
  const list = await db.complaint.findMany({
    where,
    select: {
      id: true, ref: true, title: true, category: true, civicCategory: true, status: true,
      lat: true, lng: true, severityScore: true, aiConfidence: true, slaHours: true,
      priority: true, priorityScore: true, priorityFactors: true, createdAt: true,
    },
  });
  return list.map((c) => {
    let nearbyReports = 0;
    try { nearbyReports = Number(JSON.parse(c.priorityFactors ?? "{}").duplicateReports ?? 0); } catch { /* legacy */ }
    const p = calculatePriority({
      severityScore: c.severityScore ?? 0, confidence: c.aiConfidence ?? 0,
      categoryLabel: c.category, lat: c.lat, lng: c.lng, nearbyReports, createdAt: c.createdAt,
    });
    return { ...c, priority: p.priority, priorityScore: p.score };
  });
}

const HELP_SUGGESTIONS = [
  "How many critical complaints are open?",
  "Which complaints have breached SLA?",
  "Show the 5 most severe water complaints",
  "Breakdown by category",
  "Who is the busiest engineer?",
  "What can we fix with 5 lakh?",
  "Complaints near the school",
  "Status of CMP-10250",
];

/**
 * Canned explanations of how the platform works. Hoisted to module scope so a
 * vocabulary can be derived from them — see uncoveredTerms below.
 */
const EXPLAIN_TEXT: Record<string, string> = {
        priority:
          "Priority combines the damage itself with municipal context. The score is severity x 0.5, plus confidence x 10, " +
          "plus location risk (up to 18 — a complaint within 500 m of a hospital adds 12, a school 9, a major highway 10), " +
          "plus department risk (electrical 12, water 8, roads 4, public property 4, waste 2), " +
          "plus 3 per nearby same-category report up to 12, plus 2 per day of age up to 10. " +
          "It bands at 75 Critical, 55 High, 30 Medium, below that Low. It is recomputed on every read, so complaints climb the queue as they age.",
        severity:
          "Severity comes from the geometry of what the detector found: 100 x the sum over detections of " +
          "class_weight x sqrt(area_ratio) x confidence, plus a small bonus when several separate damage regions appear in one frame, capped at 100. " +
          "Area is square-rooted so one large pothole outranks a hairline crack without saturating the scale. " +
          "Class weights are safety-driven — an exposed wire or open manhole weighs 1.00, a garbage pile 0.50.",
        duplicate:
          "A new complaint is compared against open complaints from the last 72 hours within 30 m, measured by the Haversine formula. " +
          "The photograph is turned into a 512-dimension embedding by a ResNet-18 network, and the duplicate score is " +
          "0.5 x image similarity + 0.2 x proximity + 0.2 x category match + 0.1 x description similarity. " +
          "Above the threshold, and with a matching damage class, the report is linked to the existing case instead of opening a new one.",
        sla:
          "Each civic category carries its own response-time target: electrical 12 h, waste 24 h, water 24 h, roads 48 h, public property 72 h. " +
          "The clock starts when the complaint is created. A complaint past its target still counts as open — the deadline drives escalation, not closure.",
        routing:
          "The department is chosen from what the detector saw, not from what the reporter selected. When one photograph contains several damage types, " +
          "the dominant category wins a weighted vote: argmax of class_weight x sqrt(area) x confidence, summed per category. " +
          "That category maps to exactly one department, and complaints routed this way are flagged as auto-routed so a supervisor can override them.",
        assignment:
          "Engineers are matched to complaints with the Hungarian algorithm (Kuhn-Munkres), which runs in O(n cubed) and returns the provably " +
          "minimum-cost assignment across the whole batch at once. Cost combines travel distance, skill match against the detected damage class, " +
          "current workload and complaint priority. Assigning one at a time is greedy and globally worse — an early complaint takes the engineer a later, closer one needed.",
        budget:
          "Choosing repairs under a fixed budget is a 0/1 knapsack problem, solved exactly by dynamic programming in O(n x W). " +
          "It maximises total public risk removed subject to the budget. Funding the highest-severity jobs first is greedy, and greedy is not optimal — " +
          "it spends the budget on a few expensive repairs when a larger set of cheaper ones would remove more risk. Ask me what a given budget can fix and I will show both.",
        material:
          "An engineer measures each pothole on site in metres. Volume is length x width x depth, and perimeter is 2 x (length + width); " +
          "both are computed and stored on write, so a figure that was signed off cannot drift if the formula is later changed. " +
          "The total volume drives a bill of quantities. For a bituminous road, per cubic metre: brick aggregate 0.90 m3, sand 0.30 m3, bitumen 50 kg, water 20 L, additive 2 kg. " +
          "For a concrete road, the nominal 1:2:4 (M20) mix: cement 320 kg, sand 0.47 m3, coarse aggregate 0.94 m3, water 205 L. " +
          "Procurement quantity = calculated quantity x (1 + wastage), and cement is ordered in 50 kg bags. " +
          "Cost adds indicative rupee rates, labour and machinery at 25% of materials, and contractor overhead and profit at 15%. " +
          "The bituminous proportions are estimating assumptions rather than an approved mix design; the concrete figures follow documented government specifications. " +
          "Dimensions can also be read off the photograph, but that result is always labelled ESTIMATED, because a single uncalibrated photo carries no true scale and depth comes from the severity band rather than measurement.",
        detection:
          "The detector reports its own mode on every complaint. TRAINED means a trained civic-damage model is in use. " +
          "HEURISTIC means a classical OpenCV detector is running — dark-blob and edge-density analysis with HSV road-surface masking so vegetation and sky are not reported as damage. " +
          "FALLBACK means only a generic pretrained model is loaded. The mode is shown in the interface so a demonstration detection is never mistaken for a trained model.",
      };;

const EXPLAIN_LABELS: Record<string, string> = {
        priority: "Priority", severity: "Severity", duplicate: "Duplicate detection", sla: "SLA targets",
        routing: "Department routing", assignment: "Engineer assignment", budget: "Budget planning",
        material: "Material estimate", detection: "Damage detection",
      };;

/**
 * Words a question can use without meaning it has strayed off-topic: the
 * assistant's own vocabulary plus every word appearing in the canned answers.
 * Anything outside this set is a term the platform has never heard of.
 */
const COVERED_WORDS: Set<string> = (() => {
  const words = new Set<string>(STOPWORDS);
  const add = (s: string) => {
    for (const w of normalise(s).split(" ")) if (w.length >= 3) words.add(w);
  };
  Object.values(EXPLAIN_TEXT).forEach(add);
  Object.values(EXPLAIN_LABELS).forEach(add);
  Object.keys(TOPIC_WORDS).forEach(add);
  Object.keys(CATEGORY_WORDS).forEach(add);
  Object.keys(STATUSES).forEach(add);
  Object.keys(LANDMARK_WORDS).forEach(add);
  PRIORITIES.forEach(add);
  for (const cues of Object.values(CUES)) for (const [phrase] of cues) add(phrase);
  // Ordinary question-asking words that carry no topic of their own.
  add("what why how when who where which does did do you your our tell explain mean means work works about between difference compare versus vs use used using please");
  return words;
})();

/**
 * Terms in the question that appear nowhere in the assistant's vocabulary or
 * in the answer it is about to give. A non-empty result means the canned text
 * is probably answering a different question than the one that was asked.
 */
function uncoveredTerms(question: string, answer: string): string[] {
  const inAnswer = new Set(normalise(answer).split(" ").filter((w) => w.length >= 3));
  return normalise(question)
    .split(" ")
    .filter((w) => w.length >= 3 && !COVERED_WORDS.has(w) && !inAnswer.has(w));
}

/**
 * Greetings and pleasantries, matched on the whole message rather than as
 * cues.
 *
 * "hi" carries no intent, so it used to fall through to the language model —
 * which, handed a snapshot of the backlog, answered a greeting with the
 * highest-priority pothole. Answering a greeting with a greeting is both
 * cheaper and correct. Matching is whole-message so a real question is never
 * swallowed: "which complaints are open" contains "hi", and must not match.
 */
const PLEASANTRIES: { test: RegExp; reply: string }[] = [
  { test: /^(hi|hii+|hey+|hello+|yo|hiya|namaste|hola)$/,
    reply: "Hello. Ask me anything about the complaint backlog — counts, SLA breaches, engineer workload, budgets or a specific complaint by reference." },
  { test: /^(good\s+(morning|afternoon|evening|day))$/,
    reply: "Good day. Here is what I can look up for you:" },
  { test: /^(thanks|thank\s*you|thx|ty|cheers|nice|great|cool|ok|okay|good)$/,
    reply: "Glad to help. Anything else about the backlog?" },
  { test: /^(bye|goodbye|see\s*you|good\s*night)$/,
    reply: "Goodbye." },
  { test: /^(who\s+are\s+you|what\s+are\s+you|what\s+can\s+you\s+do)$/,
    reply: "I am LUMEN's operations assistant. I answer questions about the complaint backlog by querying the database directly, so every figure I give comes from a real query. Try one of these:" },
];

export async function ask(db: PrismaClient, question: string): Promise<Answer> {
  // Checked before intent scoring: a greeting has no intent to find, and
  // sending it to a language model wastes seconds to produce a wrong answer.
  const greeting = normalise(question).replace(/[!.?,]+$/, "").trim();
  for (const p of PLEASANTRIES) {
    if (p.test.test(greeting)) {
      return {
        answer: p.reply,
        intent: "HELP",
        confidence: 1,
        entities: {},
        source: "database",
        suggestions: HELP_SUGGESTIONS,
      };
    }
  }

  const entities = extract(question);
  const { intent, confidence } = classify(question, entities);
  // Every branch below answers from a query; the one exception overrides this.
  const base = { intent, confidence, entities, source: "database" as const };

  switch (intent) {
    // -------------------------------------------------------------------
    case "COUNT": {
      let list = await livePriority(db, whereFrom(entities));
      if (entities.priority) list = list.filter((c) => c.priority === entities.priority);
      if (entities.landmark) {
        const L = LANDMARKS[entities.landmark];
        list = list.filter((c) => haversineMeters(c.lat, c.lng, L.lat, L.lng) <= 500);
      }
      const where = filterPhrase(entities);
      const near = entities.landmark ? ` within 500 m of the ${entities.landmark.toLowerCase()}` : "";
      const phrase = list.length === 1 ? where.replace(/complaints$/, "complaint") : where;
      return {
        ...base,
        answer: list.length === 0
          ? `There are no ${where}${near}.`
          : `There ${list.length === 1 ? "is" : "are"} ${list.length} ${phrase}${near}.`,
        rows: toRows(list.slice(0, 10)),
        stats: [
          { label: "Matching", value: String(list.length) },
          { label: "Critical", value: String(list.filter((c) => c.priority === "CRITICAL").length) },
          { label: "Mean severity", value: list.length ? (list.reduce((s, c) => s + (c.severityScore ?? 0), 0) / list.length).toFixed(1) : "—" },
        ],
      };
    }

    // -------------------------------------------------------------------
    case "LIST": {
      let list = await livePriority(db, whereFrom(entities));
      if (entities.priority) list = list.filter((c) => c.priority === entities.priority);
      if (entities.landmark) {
        const L = LANDMARKS[entities.landmark];
        list = list.filter((c) => haversineMeters(c.lat, c.lng, L.lat, L.lng) <= 500);
      }
      list.sort((a, b) => (b.severityScore ?? 0) - (a.severityScore ?? 0));
      const limit = entities.limit ?? 10;
      const shown = list.slice(0, limit);
      return {
        ...base,
        answer: shown.length === 0
          ? `I found no ${filterPhrase(entities)} matching that.`
          : `Here ${shown.length === 1 ? "is" : "are"} the ${shown.length === 1 ? "" : `${shown.length} `}most severe ${filterPhrase(entities)}${list.length > shown.length ? ` — ${list.length} match in total` : ""}.`,
        rows: toRows(shown),
        stats: [{ label: "Matching", value: String(list.length) }, { label: "Shown", value: String(shown.length) }],
      };
    }

    // -------------------------------------------------------------------
    case "SLA_BREACH": {
      const list = await livePriority(db, whereFrom({ ...entities, status: "OPEN" }));
      const now = Date.now();
      const breached = list
        .map((c) => ({ ...c, overdueH: (now - c.createdAt.getTime()) / 3_600_000 - (c.slaHours ?? 48) }))
        .filter((c) => c.overdueH > 0)
        .sort((a, b) => b.overdueH - a.overdueH);
      const worst = breached[0];
      return {
        ...base,
        answer: breached.length === 0
          ? "No open complaints have breached their SLA target."
          : `${plural(breached.length, "open complaint has", "open complaints have")} breached SLA. The worst is ${worst.ref}, ${Math.round(worst.overdueH)} h past its ${worst.slaHours} h target.`,
        rows: toRows(breached.slice(0, 10)),
        stats: [
          { label: "Breached", value: String(breached.length) },
          { label: "Of open", value: String(list.length) },
          { label: "Worst overdue", value: worst ? `${Math.round(worst.overdueH)} h` : "—" },
        ],
      };
    }

    // -------------------------------------------------------------------
    case "ENGINEER_LOAD": {
      const engineers = await db.engineer.findMany({
        include: { complaints: { where: { status: { in: ["ASSIGNED", "IN_PROGRESS"] } }, select: { id: true } }, department: true },
      });
      const ranked = engineers
        .map((e) => ({ name: e.name, code: e.code, zone: e.zone, status: e.status, dept: e.department?.name ?? "—", open: e.complaints.length, resolved: e.resolvedJobs }))
        .sort((a, b) => b.open - a.open);
      const busiest = ranked[0];
      const idle = ranked.filter((e) => e.open === 0 && e.status === "AVAILABLE").length;
      if (ranked.length === 0) return { ...base, answer: "No engineers are on record." };

      const byResolved = [...ranked].sort((a, b) => b.resolved - a.resolved);
      const most = byResolved[0];
      const fewest = byResolved[byResolved.length - 1];
      // "Best" and "worst" are asked often and deserve a real answer, but the
      // system records workload and jobs closed — not quality of work. Ranking
      // by resolved count and saying so is honest; calling someone the worst
      // engineer on that basis would not be.
      const ranking = /\b(worst|best|slowest|fastest|top|bottom|laziest|productive)\b/.test(
        normalise(question),
      );

      return {
        ...base,
        answer: ranking
          ? `By jobs closed, ${most.name} (${most.code}) leads with ${plural(most.resolved, "resolution")}, and ${fewest.name} (${fewest.code}) has the fewest at ${fewest.resolved}. ` +
            `Right now ${busiest.name} carries the heaviest load — ${plural(busiest.open, "open job")} in ${busiest.dept}. ` +
            `Bear in mind this measures volume, not quality: the system records what was closed and what is assigned, not how well the work was done.`
          : `${busiest.name} (${busiest.code}) is carrying the most work — ${plural(busiest.open, "open job")} in ${busiest.dept}. ${idle > 0 ? `${plural(idle, "engineer is", "engineers are")} available with nothing assigned.` : "Every available engineer has at least one job."}`,
        stats: [
          { label: "Engineers", value: String(ranked.length) },
          { label: "Busiest", value: `${busiest.name.split(" ")[0]} · ${busiest.open}` },
          { label: "Most resolved", value: `${most.name.split(" ")[0]} · ${most.resolved}` },
          { label: "Idle & available", value: String(idle) },
        ],
        engineers: ranked.map((e) => ({
          name: e.name, code: e.code, dept: e.dept, zone: e.zone,
          open: e.open, resolved: e.resolved, status: e.status,
        })),
        suggestions: ["Which complaints have breached SLA?", "How is priority calculated?"],
      };
    }

    // -------------------------------------------------------------------
    case "BREAKDOWN": {
      const list = await livePriority(db, whereFrom(entities));
      const byCat = new Map<string, number>();
      for (const c of list) byCat.set(c.civicCategory ?? "UNCLASSIFIED", (byCat.get(c.civicCategory ?? "UNCLASSIFIED") ?? 0) + 1);
      const ranked = [...byCat.entries()].sort((a, b) => b[1] - a[1]);
      const top = ranked[0];
      return {
        ...base,
        answer: ranked.length === 0
          ? "There are no open complaints to break down."
          : `${top[0] === "UNCLASSIFIED" ? "Unclassified" : CATEGORIES[top[0] as CategoryKey]?.label ?? top[0]} leads with ${plural(top[1], "open complaint")}, out of ${plural(list.length, "open complaint")} across ${plural(ranked.length, "category", "categories")}.`,
        stats: ranked.map(([k, v]) => ({
          label: k === "UNCLASSIFIED" ? "Unclassified" : CATEGORIES[k as CategoryKey]?.label ?? k,
          value: `${v} (${Math.round((v / list.length) * 100)}%)`,
        })),
      };
    }

    // -------------------------------------------------------------------
    case "DUPLICATES": {
      const [dupes, total] = await Promise.all([
        db.complaint.findMany({
          where: { duplicateOfId: { not: null } },
          select: { ref: true, title: true, priority: true, category: true, status: true, severityScore: true, dupScore: true, dupDistanceM: true, duplicateOf: { select: { ref: true } } },
          orderBy: { createdAt: "desc" }, take: 10,
        }),
        db.complaint.count(),
      ]);
      const all = await db.complaint.count({ where: { duplicateOfId: { not: null } } });
      return {
        ...base,
        answer: all === 0
          ? "No complaints have been linked as duplicates yet. Detection runs on submission — a new report within 30 m and 72 h of an existing one, with a matching damage class and a similar photograph, is linked instead of opened separately."
          : `${plural(all, "complaint has", "complaints have")} been linked as duplicates, out of ${total} total. ${dupes[0] ? `Most recent: ${dupes[0].ref} linked to ${dupes[0].duplicateOf?.ref} at ${dupes[0].dupDistanceM} m, score ${dupes[0].dupScore?.toFixed(2)}.` : ""}`,
        rows: toRows(dupes),
        stats: [{ label: "Duplicates", value: String(all) }, { label: "Total complaints", value: String(total) }],
      };
    }

    // -------------------------------------------------------------------
    case "LOOKUP": {
      if (!entities.ref) {
        // Asked after a case without naming it. Rather than refuse, show the
        // most recent ones so the reference can simply be recognised — someone
        // asking "what about my request" rarely has the number to hand.
        const recent = await db.complaint.findMany({
          orderBy: { createdAt: "desc" }, take: 5,
          select: { ref: true, title: true, priority: true, category: true, status: true, severityScore: true },
        });
        return {
          ...base,
          answer: recent.length === 0
            ? "There are no complaints on record yet."
            : "Tell me the reference — it looks like CMP-10250 and is on your submission receipt. These are the most recent, in case yours is among them:",
          rows: toRows(recent),
          suggestions: recent.slice(0, 2).map((c) => `Status of ${c.ref}`),
        };
      }
      const c = await db.complaint.findUnique({
        where: { ref: entities.ref },
        include: { department: true, engineer: true, events: { orderBy: { createdAt: "desc" }, take: 1 } },
      });
      if (!c) return { ...base, answer: `I have no complaint with reference ${entities.ref}.` };
      const ageH = Math.round((Date.now() - c.createdAt.getTime()) / 3_600_000);
      const overdue = ageH - (c.slaHours ?? 48);
      return {
        ...base,
        answer: `${c.ref} — "${c.title}". Classified as ${c.category} (${c.civicCategory ?? "unclassified"}), severity ${c.severityScore?.toFixed(1) ?? "—"}, status ${c.status.toLowerCase().replace("_", " ")}. Routed to ${c.department?.name ?? "no department"}${c.engineer ? ` and assigned to ${c.engineer.name}` : " and unassigned"}. It is ${ageH} h old${overdue > 0 ? `, which is ${Math.round(overdue)} h past its ${c.slaHours} h SLA` : `, within its ${c.slaHours} h SLA`}.`,
        rows: toRows([c]),
        stats: [
          { label: "Severity", value: c.severityScore?.toFixed(1) ?? "—" },
          { label: "Priority", value: c.priority },
          { label: "Age", value: `${ageH} h` },
          { label: "Model", value: c.aiModelMode ?? "—" },
        ],
      };
    }

    // -------------------------------------------------------------------
    case "BUDGET": {
      const { buildItems, plan } = await import("./planner.js");
      const budget = entities.budget ?? 500_000;
      const list = await livePriority(db, whereFrom({ ...entities, status: "OPEN" }));
      const items = buildItems(list.map((c) => ({
        id: c.id, ref: c.ref, title: c.title, category: c.category, civicCategory: c.civicCategory,
        lat: c.lat, lng: c.lng, severityScore: c.severityScore, priorityScore: c.priorityScore,
        priority: c.priority, slaHours: c.slaHours,
      })));
      const result = plan(items, { budget, crews: 4, horizonDays: entities.days ?? 30, depot: { lat: 12.9716, lng: 77.5946 } });
      const chosen = result.optimal.chosen;
      return {
        ...base,
        answer: chosen.length === 0
          ? `${rupees(budget)} is not enough to fund any repair in the current backlog.`
          : `With ${rupees(budget)} you can fund ${plural(chosen.length, "repair")}, spending ${rupees(result.optimal.totalCost)} and removing ${result.optimal.totalRisk.toFixed(0)} of public risk. Selecting by severity alone would fund only ${result.greedyRisk.chosen.length} and remove ${result.greedyRisk.totalRisk.toFixed(0)}.`,
        rows: chosen.slice(0, 10).map((i) => ({ ref: i.ref, title: i.title, priority: i.priority, category: i.category, status: "FUNDED", severity: i.severityScore })),
        stats: [
          { label: "Funded", value: String(chosen.length) },
          { label: "Committed", value: rupees(result.optimal.totalCost) },
          { label: "Risk removed", value: result.optimal.totalRisk.toFixed(0) },
          { label: "Deferred", value: `${result.deferred.count} (+${result.deferred.increasePct}% risk)` },
        ],
        suggestions: ["What can we fix with 10 lakh?", "Which complaints have breached SLA?"],
      };
    }

    // -------------------------------------------------------------------
    case "NEAR": {
      const landmark = entities.landmark;
      const L = landmark ? LANDMARKS[landmark] : null;
      if (!L || !landmark) {
        return { ...base, answer: "Near what? I can search around the hospital, the school or the major highway.", suggestions: ["Complaints near the hospital", "Complaints near the school"] };
      }
      const list = (await livePriority(db, whereFrom(entities)))
        .map((c) => ({ ...c, distM: haversineMeters(c.lat, c.lng, L.lat, L.lng) }))
        .filter((c) => c.distM <= 500)
        .sort((a, b) => a.distM - b.distM);
      return {
        ...base,
        answer: list.length === 0
          ? `No open complaints lie within 500 m of the ${landmark.toLowerCase()}.`
          : `${plural(list.length, "open complaint lies", "open complaints lie")} within 500 m of the ${landmark.toLowerCase()}. These carry extra priority weight because of it — the nearest is ${list[0].ref} at ${Math.round(list[0].distM)} m.`,
        rows: toRows(list.slice(0, 10)),
        stats: [
          { label: "Within 500 m", value: String(list.length) },
          { label: "Critical", value: String(list.filter((c) => c.priority === "CRITICAL").length) },
          { label: "Nearest", value: list[0] ? `${Math.round(list[0].distM)} m` : "—" },
        ],
      };
    }

    // -------------------------------------------------------------------
    case "OVERVIEW": {
      const list = await livePriority(db, { duplicateOfId: null, status: { in: OPEN_STATUSES } });
      const now = Date.now();
      const breached = list.filter((c) => (now - c.createdAt.getTime()) / 3_600_000 > (c.slaHours ?? 48)).length;
      const critical = list.filter((c) => c.priority === "CRITICAL").length;
      const unassigned = list.filter((c) => c.status === "SUBMITTED").length;
      const byCat = new Map<string, number>();
      for (const c of list) byCat.set(c.civicCategory ?? "UNCLASSIFIED", (byCat.get(c.civicCategory ?? "UNCLASSIFIED") ?? 0) + 1);
      const top = [...byCat.entries()].sort((a, b) => b[1] - a[1])[0];
      const closed = await db.complaint.count({ where: { status: "CLOSED" } });
      return {
        ...base,
        answer: `${plural(list.length, "complaint is", "complaints are")} open, ${critical} of them critical and ${unassigned} still unassigned. ${breached > 0 ? `${plural(breached, "has", "have")} breached SLA.` : "None have breached SLA."} ${top ? `${CATEGORIES[top[0] as CategoryKey]?.label ?? top[0]} is the largest category with ${top[1]}.` : ""} ${closed} closed to date.`,
        stats: [
          { label: "Open", value: String(list.length) },
          { label: "Critical", value: String(critical) },
          { label: "Unassigned", value: String(unassigned) },
          { label: "SLA breached", value: String(breached) },
          { label: "Closed", value: String(closed) },
        ],
        suggestions: ["Which complaints have breached SLA?", "Who is the busiest engineer?", "What can we fix with 5 lakh?"],
      };
    }

    // -------------------------------------------------------------------
    case "WHY": {
      if (!entities.ref) {
        return {
          ...base,
          answer: "Tell me which complaint and I will explain where it stands — give me a reference like CMP-10250. I can show what stage it is at, how many higher-priority jobs are ahead of it, and whether it has passed its deadline.",
          suggestions: ["Why is CMP-10250 still pending?", "How is priority calculated?"],
        };
      }
      const c = await db.complaint.findUnique({
        where: { ref: entities.ref },
        include: { department: true, engineer: { include: { complaints: { where: { status: { in: ["ASSIGNED", "IN_PROGRESS"] } }, select: { id: true } } } } },
      });
      if (!c) return { ...base, answer: `I have no complaint with reference ${entities.ref}.` };

      if (c.status === "CLOSED") {
        return {
          ...base,
          answer: `${c.ref} is not pending — it was closed${c.closedAt ? ` on ${c.closedAt.toDateString()}` : ""}.`,
          rows: toRows([c]), stats: [{ label: "Status", value: "CLOSED" }],
        };
      }

      // Where it sits in the queue, by live priority within its department.
      const peers = (await livePriority(db, { duplicateOfId: null, status: { in: OPEN_STATUSES }, departmentId: c.departmentId }))
        .sort((a, b) => b.priorityScore - a.priorityScore);
      const rank = peers.findIndex((p) => p.id === c.id) + 1;
      const ahead = Math.max(0, rank - 1);
      const ageH = Math.round((Date.now() - c.createdAt.getTime()) / 3_600_000);
      const overdue = ageH - (c.slaHours ?? 48);

      const stage: Record<string, string> = {
        SUBMITTED: "it has been classified and routed, but no engineer has been assigned yet",
        ASSIGNED: `it has been assigned to ${c.engineer?.name ?? "an engineer"}, who has not started on site yet`,
        IN_PROGRESS: `${c.engineer?.name ?? "the assigned engineer"} has started work on site`,
        PENDING_REVIEW: "the work is reported complete and it is waiting for a supervisor to approve closure",
      };

      const reasons: string[] = [];
      if (ahead > 0) reasons.push(`${ahead} higher-priority ${ahead === 1 ? "complaint is" : "complaints are"} ahead of it in ${c.department?.name ?? "its department"}`);
      if (c.engineer && c.engineer.complaints.length > 1) reasons.push(`${c.engineer.name} is carrying ${c.engineer.complaints.length} open jobs`);
      if (c.status === "SUBMITTED") reasons.push("it is still waiting on the assignment run");

      return {
        ...base,
        answer:
          `${c.ref} is at "${c.status.toLowerCase().replace("_", " ")}" — ${stage[c.status] ?? "it is in progress"}. ` +
          `It is ${ageH} h old${overdue > 0 ? `, which is ${Math.round(overdue)} h past its ${c.slaHours} h target` : `, still inside its ${c.slaHours} h target`}. ` +
          `By live priority it ranks ${rank} of ${peers.length} open ${c.department?.name ?? ""} complaints (score ${Math.round(peers[rank - 1]?.priorityScore ?? 0)}/100).` +
          (reasons.length ? ` The hold-up: ${reasons.join("; ")}.` : "") +
          ` Its priority rises automatically as it ages, so it moves up the queue on its own.`,
        rows: toRows([c]),
        stats: [
          { label: "Stage", value: c.status.replace("_", " ") },
          { label: "Queue rank", value: `${rank} of ${peers.length}` },
          { label: "Age", value: `${ageH} h` },
          { label: overdue > 0 ? "Overdue by" : "SLA", value: overdue > 0 ? `${Math.round(overdue)} h` : `${c.slaHours} h` },
        ],
        suggestions: ["How is priority calculated?", `Status of ${c.ref}`],
      };
    }

    // -------------------------------------------------------------------
    case "EXPLAIN": {
      const topic = entities.topic ?? "priority";
      const canned = EXPLAIN_TEXT[topic] ?? EXPLAIN_TEXT.priority;

      // The canned answers are exact and instant, so they stay the default.
      // But the topic matcher fires on a single keyword: "what is YOLO and why
      // the nano version" matches on "yolo" and gets back a paragraph about
      // detector modes, which does not answer the question at all. Being
      // confidently off-topic is worse than being slow, so when the question
      // contains terms the answer never addresses, hand it to the model with
      // the canned text as source material.
      const unknown = uncoveredTerms(question, canned);
      if (unknown.length > 0) {
        const generated = await callLLM(db, question, canned);
        if (generated) {
          return {
            ...base,
            answer: generated.text,
            source: generated.source,
            suggestions: ["How is severity calculated?", "How does duplicate detection work?", "How does assignment work?"],
          };
        }
      }

      return {
        ...base,
        answer: canned,
        stats: [{ label: "Topic", value: EXPLAIN_LABELS[topic] ?? topic }],
        suggestions: ["How is severity calculated?", "How does duplicate detection work?", "How does assignment work?"],
      };
    }

    // -------------------------------------------------------------------
    case "HELP":
      return {
        ...base,
        answer: "I answer questions about the complaint backlog by querying the database directly — every figure I give comes from a real query, and I show you the rows behind it. Try one of these:",
        suggestions: HELP_SUGGESTIONS,
      };

    // -------------------------------------------------------------------
    // Nothing matched. Before giving up, hand the question to Claude with a
    // snapshot of the live backlog — that covers the phrasings and the
    // open-ended questions the rule set was never going to reach. If no key
    // is configured or the call fails, this falls through to the local reply
    // below, so the assistant still works with no network and no key.
    default: {
      const generated = await callLLM(db, question);
      if (generated) {
        return { ...base, answer: generated.text, source: generated.source, suggestions: HELP_SUGGESTIONS };
      }
      return {
        ...base,
        answer: "I could not work out what you are asking. I cover the complaint backlog, SLA breaches, engineer workload, duplicates, budget planning and location queries — not general questions.",
        suggestions: HELP_SUGGESTIONS,
        source: "database",
      };
    }
  }
}
