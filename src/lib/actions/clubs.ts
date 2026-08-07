"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

export async function getClubs() {
  return db.club.findMany({
    include: {
      members: { include: { employee: true } },
      _count: { select: { members: true } },
    },
    orderBy: { name: "asc" },
  });
}

export async function createClub(data: {
  name: string;
  description?: string;
  emoji?: string;
}) {
  const club = await db.club.create({
    data: {
      name: data.name,
      description: data.description || null,
      emoji: data.emoji || "🎯",
    },
  });
  revalidatePath("/clubs");
  return club;
}

export async function joinClub(clubId: string, employeeId: string) {
  const member = await db.clubMember.create({
    data: { clubId, employeeId },
  });
  revalidatePath("/clubs");
  return member;
}

export async function leaveClub(clubId: string, employeeId: string) {
  await db.clubMember.delete({
    where: { clubId_employeeId: { clubId, employeeId } },
  });
  revalidatePath("/clubs");
}

export async function deleteClub(clubId: string) {
  await db.club.delete({ where: { id: clubId } });
  revalidatePath("/clubs");
}
