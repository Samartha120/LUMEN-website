"use server";

import { redirect } from "next/navigation";
import { destroySession, getSession } from "@/lib/auth";
import { db } from "@/lib/db";

export async function logout() {
  const session = await getSession();
  if (session) {
    await db.auditLog.create({
      data: {
        actor: session.name,
        actorRole: session.role,
        action: "LOGOUT",
        module: "Authentication",
        target: session.email,
        details: "User signed out",
        ip: "127.0.0.1",
      },
    });
  }
  await destroySession();
  redirect("/auth/login");
}
