import { requireUser } from "@/server/auth/guards";
import { subscribe } from "@/server/events/bus";
import { route } from "@/server/http";

export const dynamic = "force-dynamic";

const HEARTBEAT_MS = 25_000;

/** Luồng Server-Sent Events: mỗi sự kiện chỉ mang loại và định danh (contracts/api.md). */
export const GET = route(async (req) => {
  const user = await requireUser(req);
  const encoder = new TextEncoder();
  let cleanup = () => {};

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (text: string) => {
        try {
          controller.enqueue(encoder.encode(text));
        } catch {
          cleanup();
        }
      };
      send(": connected\n\n");
      const unsubscribe = subscribe((e) => {
        if (e.toUserId && e.toUserId !== user.id) return;
        send(`event: ${e.type}\ndata: ${JSON.stringify(e.data)}\n\n`);
      });
      const heartbeat = setInterval(() => send(": ping\n\n"), HEARTBEAT_MS);
      cleanup = () => {
        clearInterval(heartbeat);
        unsubscribe();
        try {
          controller.close();
        } catch {}
      };
      req.signal.addEventListener("abort", () => cleanup());
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
});
