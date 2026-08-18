import { Router } from "express";
import { db } from "../lib/db.js";
import { requireAuth } from "../lib/auth.js";
import { ask } from "../lib/assistant.js";

const router = Router();

/**
 * POST /api/assistant  { message }
 *
 * Available to every signed-in role. The queries it runs are read-only, and
 * an engineer sees the same aggregate picture a supervisor does — this answers
 * questions about the backlog, it does not expose an action they could not
 * already take through the interface.
 */
router.post("/", requireAuth, async (req, res) => {
  const message = String(req.body?.message ?? "").trim();
  if (!message) return res.status(400).json({ error: "A message is required." });
  if (message.length > 500) return res.status(400).json({ error: "Message too long." });

  try {
    res.json(await ask(db, message));
  } catch (e) {
    res.status(500).json({ error: `Assistant failed: ${(e as Error).message}` });
  }
});

export default router;
