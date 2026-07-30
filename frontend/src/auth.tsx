import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api } from "./lib/api";

export type SessionUser = {
  sub: string;
  email: string;
  name: string;
  role: string;
  departmentId: string | null;
};

type AuthCtx = {
  user: SessionUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const Ctx = createContext<AuthCtx>(null as unknown as AuthCtx);
export const useAuth = () => useContext(Ctx);

function mapUser(dbUser: any): SessionUser | null {
  if (!dbUser) return null;
  const role = dbUser.role === "ADMIN" || dbUser.role === "SUPER_ADMIN" ? "ADMINISTRATOR" : dbUser.role;
  return {
    sub: dbUser.id || dbUser.sub,
    email: dbUser.email,
    name: dbUser.fullName || dbUser.name || "",
    role: role,
    departmentId: dbUser.departmentId || null,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("access_token");
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }

    api.get("/auth/me")
      .then((d) => setUser(mapUser(d.user)))
      .catch(() => {
        localStorage.removeItem("access_token");
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  async function login(email: string, password: string) {
    const d = await api.post("/auth/login", { email, password });
    if (d.access_token) {
      localStorage.setItem("access_token", d.access_token);
      setUser(mapUser(d.user));
    } else {
      throw new Error("No access token returned.");
    }
  }

  async function logout() {
    await api.post("/auth/logout").catch(() => {});
    localStorage.removeItem("access_token");
    setUser(null);
  }

  return <Ctx.Provider value={{ user, loading, login, logout }}>{children}</Ctx.Provider>;
}
