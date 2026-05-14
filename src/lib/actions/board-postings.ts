"use server";

import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth-helpers";
import { revalidatePath } from "next/cache";

export type BoardName = "CAREERS" | "JOBING" | "BREEZY";
export type BoardStatus = "NOT_POSTED" | "PUBLISHED" | "PAUSED" | "CLOSED" | "FAILED";

export type BoardPostingView = {
  board: BoardName;
  status: BoardStatus;
  externalId: string | null;
  titleOverride: string | null;
  lastError: string | null;
  lastSyncAt: Date;
  supports: { post: boolean; pause: boolean; resume: boolean };
};

export async function getBoardPostings(positionId: string): Promise<BoardPostingView[]> {
  const [existing, position] = await Promise.all([
    db.positionBoardPosting.findMany({ where: { positionId } }),
    db.position.findUnique({ where: { id: positionId }, select: { published: true, status: true } }),
  ]);
  const lookup = new Map(existing.map((p) => [p.board, p]));

  const boards: BoardName[] = ["CAREERS", "JOBING", "BREEZY"];
  const supports: Record<BoardName, { post: boolean; pause: boolean; resume: boolean }> = {
    CAREERS: { post: true, pause: true, resume: true },
    JOBING: { post: false, pause: false, resume: false },
    BREEZY: { post: true, pause: true, resume: true },
  };

  return boards.map((b) => {
    if (b === "CAREERS") {
      const publishable = position?.status === "OPEN";
      const status: BoardStatus = !publishable
        ? "NOT_POSTED"
        : position?.published
        ? "PUBLISHED"
        : "PAUSED";
      return {
        board: "CAREERS" as const,
        status,
        externalId: null,
        titleOverride: null,
        lastError: null,
        lastSyncAt: new Date(),
        supports: supports.CAREERS,
      };
    }
    const row = lookup.get(b);
    return {
      board: b,
      status: (row?.status as BoardStatus) || "NOT_POSTED",
      externalId: row?.externalId || null,
      titleOverride: row?.titleOverride || null,
      lastError: row?.lastError || null,
      lastSyncAt: row?.lastSyncAt || new Date(0),
      supports: supports[b],
    };
  });
}

export async function setBoardTitleOverride(positionId: string, board: BoardName, title: string | null) {
  await requireAuth();
  if (board === "CAREERS" || board === "JOBING") {
    return { success: false, error: "Title overrides don't apply to this board" };
  }
  const trimmed = title?.trim() || null;
  await db.positionBoardPosting.upsert({
    where: { positionId_board: { positionId, board } },
    create: { positionId, board, status: "NOT_POSTED", titleOverride: trimmed },
    update: { titleOverride: trimmed },
  });
  revalidatePath("/cv");
  return { success: true };
}

async function upsertPosting(positionId: string, board: BoardName, data: Partial<{ status: BoardStatus; externalId: string | null; lastError: string | null }>) {
  await db.positionBoardPosting.upsert({
    where: { positionId_board: { positionId, board } },
    create: {
      positionId,
      board,
      status: data.status || "NOT_POSTED",
      externalId: data.externalId ?? null,
      lastError: data.lastError ?? null,
      lastSyncAt: new Date(),
    },
    update: {
      ...(data.status !== undefined ? { status: data.status } : {}),
      ...(data.externalId !== undefined ? { externalId: data.externalId } : {}),
      ...(data.lastError !== undefined ? { lastError: data.lastError } : {}),
      lastSyncAt: new Date(),
    },
  });
}

export async function postToBoard(positionId: string, board: BoardName): Promise<{ success: boolean; error?: string }> {
  await requireAuth();
  const position = await db.position.findUnique({
    where: { id: positionId },
    include: { department: true },
  });
  if (!position) return { success: false, error: "Position not found" };

  if (board === "CAREERS") {
    if (position.status !== "OPEN") {
      return { success: false, error: "Position must be OPEN to publish on the careers page. Reopen it first." };
    }
    await db.position.update({ where: { id: positionId }, data: { published: true } });
    revalidatePath("/cv");
    revalidatePath("/careers");
    return { success: true };
  }

  if (board === "JOBING") {
    const msg = "Jobing API is read-only — job creation must be done in the pro.jobing dashboard.";
    await upsertPosting(positionId, "JOBING", { status: "FAILED", lastError: msg });
    revalidatePath("/cv");
    return { success: false, error: msg };
  }

  if (board === "BREEZY") {
    const platform = await db.recruitmentPlatform.findUnique({ where: { name: "Breezy HR" } });
    if (!platform?.refreshToken || !platform.accountIdentifier) {
      const err = "Breezy HR is not connected. Connect it in Settings first.";
      await upsertPosting(positionId, "BREEZY", { status: "FAILED", lastError: err });
      revalidatePath("/cv");
      return { success: false, error: err };
    }
    try {
      const decoded = Buffer.from(platform.refreshToken, "base64").toString("utf-8");
      const [email, password] = decoded.split("::");
      const { breezySignIn, postJobToBreezy } = await import("@/lib/platform-sync/clients/breezy");
      const signin = await breezySignIn(email, password);
      if (!signin.accessToken) {
        const err = "Breezy authentication failed — please reconnect.";
        await upsertPosting(positionId, "BREEZY", { status: "FAILED", lastError: err });
        return { success: false, error: err };
      }
      const existing = await db.positionBoardPosting.findUnique({
        where: { positionId_board: { positionId, board: "BREEZY" } },
        select: { titleOverride: true },
      });
      const result = await postJobToBreezy({
        accessToken: signin.accessToken,
        companyId: platform.accountIdentifier,
        title: existing?.titleOverride || position.title,
        description: position.description || undefined,
        requirements: position.requirements || undefined,
        department: position.department?.name,
        location: position.location || undefined,
        salary: position.salary || undefined,
        type: position.type || undefined,
        publishState: "published",
      });
      if (!result.success) {
        await upsertPosting(positionId, "BREEZY", { status: "FAILED", lastError: result.error || "Failed" });
        revalidatePath("/cv");
        return { success: false, error: result.error };
      }
      await upsertPosting(positionId, "BREEZY", { status: "PUBLISHED", externalId: result.positionId ?? null, lastError: null });
      revalidatePath("/cv");
      return { success: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed";
      await upsertPosting(positionId, "BREEZY", { status: "FAILED", lastError: msg });
      return { success: false, error: msg };
    }
  }

  return { success: false, error: "Unsupported board" };
}

export async function pauseOnBoard(positionId: string, board: BoardName): Promise<{ success: boolean; error?: string }> {
  await requireAuth();

  if (board === "CAREERS") {
    await db.position.update({ where: { id: positionId }, data: { published: false } });
    revalidatePath("/cv");
    revalidatePath("/careers");
    return { success: true };
  }

  const posting = await db.positionBoardPosting.findUnique({
    where: { positionId_board: { positionId, board } },
  });
  if (!posting || !posting.externalId) return { success: false, error: "This position isn't posted on that board yet." };

  if (board === "JOBING") {
    return { success: false, error: "Jobing API is read-only." };
  }

  if (board === "BREEZY") {
    const platform = await db.recruitmentPlatform.findUnique({ where: { name: "Breezy HR" } });
    if (!platform?.refreshToken || !platform.accountIdentifier) return { success: false, error: "Breezy not connected." };
    const decoded = Buffer.from(platform.refreshToken, "base64").toString("utf-8");
    const [email, password] = decoded.split("::");
    const { breezySignIn, updateBreezyPositionState } = await import("@/lib/platform-sync/clients/breezy");
    const signin = await breezySignIn(email, password);
    if (!signin.accessToken) return { success: false, error: "Breezy auth failed — reconnect it." };
    const r = await updateBreezyPositionState({
      accessToken: signin.accessToken,
      companyId: platform.accountIdentifier,
      positionId: posting.externalId,
      state: "draft",
    });
    if (!r.success) {
      await upsertPosting(positionId, "BREEZY", { lastError: r.error || "Failed" });
      return r;
    }
    await upsertPosting(positionId, "BREEZY", { status: "PAUSED", lastError: null });
    revalidatePath("/cv");
    return { success: true };
  }

  return { success: false, error: "Unsupported board" };
}

export async function closeOnBoard(positionId: string, board: BoardName): Promise<{ success: boolean; error?: string }> {
  await requireAuth();

  if (board === "CAREERS") {
    await db.position.update({ where: { id: positionId }, data: { published: false } });
    revalidatePath("/cv");
    revalidatePath("/careers");
    return { success: true };
  }

  const posting = await db.positionBoardPosting.findUnique({
    where: { positionId_board: { positionId, board } },
  });
  if (!posting || !posting.externalId) return { success: true }; // never posted — nothing to close

  if (board === "JOBING") {
    return { success: false, error: "Jobing API is read-only." };
  }

  if (board === "BREEZY") {
    const platform = await db.recruitmentPlatform.findUnique({ where: { name: "Breezy HR" } });
    if (!platform?.refreshToken || !platform.accountIdentifier) return { success: false, error: "Breezy not connected." };
    const decoded = Buffer.from(platform.refreshToken, "base64").toString("utf-8");
    const [email, password] = decoded.split("::");
    const { breezySignIn, updateBreezyPositionState } = await import("@/lib/platform-sync/clients/breezy");
    const signin = await breezySignIn(email, password);
    if (!signin.accessToken) return { success: false, error: "Breezy auth failed — reconnect it." };
    const r = await updateBreezyPositionState({
      accessToken: signin.accessToken,
      companyId: platform.accountIdentifier,
      positionId: posting.externalId,
      state: "closed",
    });
    if (!r.success) {
      await upsertPosting(positionId, "BREEZY", { lastError: r.error || "Failed" });
      return r;
    }
    await upsertPosting(positionId, "BREEZY", { status: "CLOSED", lastError: null });
    revalidatePath("/cv");
    return { success: true };
  }

  return { success: false, error: "Unsupported board" };
}

/** Close the position on every board it's currently posted to. Errors per board are swallowed and logged. */
export async function closeAllBoardsForPosition(positionId: string) {
  const boards: BoardName[] = ["CAREERS", "JOBING", "BREEZY"];
  for (const board of boards) {
    try {
      const r = await closeOnBoard(positionId, board);
      if (!r.success) console.error(`[closeAllBoards] ${board} failed:`, r.error);
    } catch (err) {
      console.error(`[closeAllBoards] ${board} threw:`, err);
    }
  }
}

export async function resumeOnBoard(positionId: string, board: BoardName): Promise<{ success: boolean; error?: string }> {
  await requireAuth();

  if (board === "CAREERS") {
    await db.position.update({ where: { id: positionId }, data: { published: true } });
    revalidatePath("/cv");
    revalidatePath("/careers");
    return { success: true };
  }

  const posting = await db.positionBoardPosting.findUnique({
    where: { positionId_board: { positionId, board } },
  });
  if (!posting || !posting.externalId) return { success: false, error: "This position isn't posted on that board yet." };

  if (board === "JOBING") {
    return { success: false, error: "Jobing API is read-only." };
  }

  if (board === "BREEZY") {
    const platform = await db.recruitmentPlatform.findUnique({ where: { name: "Breezy HR" } });
    if (!platform?.refreshToken || !platform.accountIdentifier) return { success: false, error: "Breezy not connected." };
    const decoded = Buffer.from(platform.refreshToken, "base64").toString("utf-8");
    const [email, password] = decoded.split("::");
    const { breezySignIn, updateBreezyPositionState } = await import("@/lib/platform-sync/clients/breezy");
    const signin = await breezySignIn(email, password);
    if (!signin.accessToken) return { success: false, error: "Breezy auth failed — reconnect it." };
    const r = await updateBreezyPositionState({
      accessToken: signin.accessToken,
      companyId: platform.accountIdentifier,
      positionId: posting.externalId,
      state: "published",
    });
    if (!r.success) {
      await upsertPosting(positionId, "BREEZY", { lastError: r.error || "Failed" });
      return r;
    }
    await upsertPosting(positionId, "BREEZY", { status: "PUBLISHED", lastError: null });
    revalidatePath("/cv");
    return { success: true };
  }

  return { success: false, error: "Unsupported board" };
}
