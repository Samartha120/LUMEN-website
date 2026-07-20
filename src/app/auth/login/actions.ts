"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { createSession } from "@/lib/auth";
import { ROLE_LABELS } from "@/lib/rbac";

export type LoginState = { error?: string };

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) return { error: "Email and password are required." };

  const user = await db.user.findUnique({ where: { email } });
  if (!user || user.password !== password) {
    return { error: "Invalid credentials. Use one of the demo accounts below." };
  }

  await createSession({
    sub: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    departmentId: user.departmentId,
  });

  await db.auditLog.create({
    data: {
      actor: user.name,
      actorRole: user.role,
      action: "LOGIN_SUCCESS",
      module: "Authentication",
      target: user.email,
      details: `${ROLE_LABELS[user.role] ?? user.role} signed in`,
      ip: "127.0.0.1",
    },
  });

  redirect("/app/dashboard");
}
