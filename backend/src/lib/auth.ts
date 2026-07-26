import { SignJWT, jwtVerify } from "jose";
import type { Request, Response, NextFunction } from "express";

const SECRET = new TextEncoder().encode(
  process.env.LUMEN_SESSION_SECRET ?? "lumen-dev-secret-change-in-production"
);
export const COOKIE = "lumen_session";

export type Session = {
  sub: string;
  email: string;
  name: string;
  role: string;
  departmentId: string | null;
};

export async function signSession(user: Session): Promise<string> {
  return new SignJWT(user)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("12h")
    .sign(SECRET);
}

export async function readSession(token: string | undefined): Promise<Session | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, SECRET);
    return payload as unknown as Session;
  } catch {
    return null;
  }
}

// Express types augmented so req.session is available downstream.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      session?: Session;
    }
  }
}

/** Populate req.session from the cookie if present (does not block). */
export async function attachSession(req: Request, _res: Response, next: NextFunction) {
  req.session = (await readSession(req.cookies?.[COOKIE])) ?? undefined;
  next();
}

/** Block the request unless authenticated. */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session) return res.status(401).json({ error: "Not authenticated." });
  next();
}

/** Block the request unless the session role is in `roles`. */
export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.session) return res.status(401).json({ error: "Not authenticated." });
    if (!roles.includes(req.session.role))
      return res.status(403).json({ error: "Your role cannot perform this action." });
    next();
  };
}
