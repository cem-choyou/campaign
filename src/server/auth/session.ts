import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { auth } from "@/server/auth/config";
import { db } from "@/server/db";

// The user and their memberships are re-read from the database on every request, so a role
// change applies without signing in again (§7, lesson from Essential).
export const getCurrentUser = cache(async () => {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return null;

  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      image: true,
      isSuperAdmin: true,
      isActive: true,
      lastBrandId: true,
      memberships: {
        select: { brandId: true, role: true, clientCanApprove: true },
      },
    },
  });

  if (!user) return null;
  if (!user.isActive) {
    // Forced sign-out of a deactivated account (§9.3).
    await db.session.deleteMany({ where: { userId: user.id } });
    return null;
  }
  return user;
});

export type CurrentUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/connexion");
  return user;
}
