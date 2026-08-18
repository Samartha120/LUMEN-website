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
  res.json({ user: session });
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
