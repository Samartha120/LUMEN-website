import bcrypt from "bcrypt";
import { Router } from "express";
import { db } from "../lib/db.js";
import { signSession, COOKIE, requireAuth } from "../lib/auth.js";
import { ROLE_LABELS } from "../lib/rbac.js";

const router = Router();

router.post("/login", async (req, res) => {
  const email = String(req.body?.email ?? "").trim().toLowerCase();
  const password = String(req.body?.password ?? "");
  if (!email || !password) return res.status(400).json({ error: "Email and password are required." });

  const user = await db.user.findUnique({ where: { email } });
  // bcrypt.compare is deliberately slow and constant-time, so a wrong password
  // costs the same as a right one — no timing signal, and a leaked database
  // does not hand over usable credentials.
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return res.status(401).json({ error: "Invalid credentials. Use one of the demo accounts." });
  }

  const session = { sub: user.id, email: user.email, name: user.name, role: user.role, departmentId: user.departmentId };
  const token = await signSession(session);

  await db.auditLog.create({
    data: {
      actor: user.name, actorRole: user.role, action: "LOGIN_SUCCESS",
      module: "Authentication", target: user.email,
      details: `${ROLE_LABELS[user.role] ?? user.role} signed in`,
    },
  });

  res.cookie(COOKIE, token, { httpOnly: true, sameSite: "lax", maxAge: 12 * 3600 * 1000 });
  // The mobile app cannot read the cookie, so it asks for the token in the
  // body and stores it itself. Only returned when explicitly requested: the
  // web app never asks, so its session stays in the httpOnly cookie where a
  // cross-site script cannot reach it.
  const wantsToken = String(req.body?.client ?? "") === "mobile";
  res.json(wantsToken ? { user: session, token } : { user: session });
});

/**
 * Public sign-up. Creates a CITIZEN account and signs it in.
 *
 * The role is hardcoded rather than read from the request: a public endpoint
 * that lets the caller pick their own role is an account-takeover waiting to
 * happen. Staff accounts are created by seeding, never here.
 */
router.post("/register", async (req, res) => {
  const email = String(req.body?.email ?? "").trim().toLowerCase();
  const password = String(req.body?.password ?? "");
  const name = String(req.body?.name ?? "").trim();

  if (!name) return res.status(400).json({ error: "Please enter your name." });
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
    return res.status(400).json({ error: "Please enter a valid email address." });
  if (password.length < 8)
    return res.status(400).json({ error: "Password must be at least 8 characters." });

  if (await db.user.findUnique({ where: { email } }))
    return res.status(409).json({ error: "An account with this email already exists. Sign in instead." });

  const user = await db.user.create({
    data: {
      email, name, role: "CITIZEN",
      // Cost 10, the same as the seeded accounts. Never store the password.
      passwordHash: await bcrypt.hash(password, 10),
    },
  });

  const session = { sub: user.id, email: user.email, name: user.name, role: user.role, departmentId: null };
  const token = await signSession(session);

  await db.auditLog.create({
    data: {
      actor: user.name, actorRole: user.role, action: "CITIZEN_REGISTERED",
      module: "Authentication", target: user.email, details: "Citizen account created",
    },
  });

  res.cookie(COOKIE, token, { httpOnly: true, sameSite: "lax", maxAge: 12 * 3600 * 1000 });
  // Same rule as sign-in: the token is handed back only to a client that
  // cannot use the cookie. See the note there.
  const wantsToken = String(req.body?.client ?? "") === "mobile";
  res.status(201).json(wantsToken ? { user: session, token } : { user: session });
});

router.post("/logout", async (req, res) => {
  if (req.session) {
    await db.auditLog.create({
      data: {
        actor: req.session.name, actorRole: req.session.role, action: "LOGOUT",
        module: "Authentication", target: req.session.email, details: "User signed out",
      },
    });
  }
  res.clearCookie(COOKIE);
  res.json({ ok: true });
});

router.get("/me", requireAuth, (req, res) => {
  res.json({ user: req.session });
});

export default router;
