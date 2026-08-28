import { db } from "./db.js";

/**
 * Tell someone something happened to their complaint.
 *
 * Notifications are written where the event occurs rather than derived later
 * from the timeline, because the two answer different questions: the timeline
 * is the record of what happened to a complaint, this is the list of things a
 * particular person has not yet seen.
 *
 * Never throws. A notification that cannot be written must not roll back the
 * status change that triggered it — the work being done is the important part,
 * telling someone about it is not worth failing a request over.
 */
export async function notify(
  userId: string | null | undefined,
  complaintId: string,
  type: string,
  message: string,
): Promise<void> {
  if (!userId) return; // seeded and staff-entered complaints have no reporter
  try {
    await db.notification.create({ data: { userId, complaintId, type, message } });
  } catch {
    /* a missing notification is not worth failing the request over */
  }
}

/** Everyone who should hear about a complaint changing: its reporter, for now. */
export async function notifyReporter(
  complaintId: string,
  type: string,
  message: string,
): Promise<void> {
  const c = await db.complaint.findUnique({
    where: { id: complaintId },
    select: { reporterId: true },
  });
  await notify(c?.reporterId, complaintId, type, message);
}

/** Supervisors of a department — used when a resident disputes a closure. */
export async function notifyDepartment(
  departmentId: string,
  complaintId: string,
  type: string,
  message: string,
): Promise<void> {
  const staff = await db.user.findMany({
    where: {
      OR: [
        // Supervisors of the department that owns the work.
        { departmentId, role: "SUPERVISOR" },
        // Administrators oversee every department and are not attached to one,
        // so filtering by departmentId would have excluded them entirely —
        // which meant a disputed closure reached nobody when the complaint
        // belonged to a department whose supervisor was someone else.
        { role: "ADMINISTRATOR" },
      ],
    },
    select: { id: true },
  });
  await Promise.all(staff.map((u) => notify(u.id, complaintId, type, message)));
}
