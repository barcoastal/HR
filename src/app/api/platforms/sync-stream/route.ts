import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { syncCandidatesStreaming } from "@/lib/actions/platform-sync-stream";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id && process.env.NODE_ENV === "production") {
    return new Response("Unauthorized", { status: 401 });
  }

  const platformId = request.nextUrl.searchParams.get("platformId");
  if (!platformId) {
    return new Response("Missing platformId", { status: 400 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const event of syncCandidatesStreaming(platformId)) {
          const data = `data: ${JSON.stringify(event)}\n\n`;
          controller.enqueue(encoder.encode(data));
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        const errorEvent = JSON.stringify({
          type: "error",
          detail: message,
          fetched: 0,
          created: 0,
          skipped: 0,
          page: 0,
          total: 0,
        });
        controller.enqueue(encoder.encode(`data: ${errorEvent}\n\n`));
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
