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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/auth/me")
      .then((d) => setUser(d.user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  async function login(email: string, password: string) {
    const d = await api.post("/auth/login", { email, password });
    setUser(d.user);
  }
  async function logout() {
    await api.post("/auth/logout").catch(() => {});
    setUser(null);
  }

  return <Ctx.Provider value={{ user, loading, login, logout }}>{children}</Ctx.Provider>;
}
