import { NextRequest } from "next/server";
import { syncCandidatesStreaming, resyncCandidatesStreaming } from "@/lib/actions/platform-sync-stream";

export const runtime = "nodejs";
export const maxDuration = 300; // 5 min timeout for long syncs

export async function GET(request: NextRequest) {

  const platformId = request.nextUrl.searchParams.get("platformId");
  if (!platformId) {
    return new Response("Missing platformId", { status: 400 });
  }

  const forceUpdate = request.nextUrl.searchParams.get("force") === "1";
  const purge = request.nextUrl.searchParams.get("purge") === "1";

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const generator = forceUpdate
          ? resyncCandidatesStreaming(platformId, purge)
          : syncCandidatesStreaming(platformId);
        for await (const event of generator) {
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
