import { z } from "zod";
import { requireUser } from "@/server/auth/guards";
import { simulatorEnabled } from "@/server/channels/registry";
import { signSimulator, simulatorPayload, simulatorState } from "@/server/channels/simulator";
import { notFound, parseBody, route } from "@/server/http";
import { receiveWebhook } from "@/server/inbox/receive";

/** Điều khiển kênh giả lập. Chỉ bật khi ENABLE_SIMULATOR=true; tắt thì 404. */

const slug = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "khach";

export const GET = route(async (req) => {
  if (!simulatorEnabled()) throw notFound();
  await requireUser(req);
  return Response.json({
    rejectWith: simulatorState.rejectWith,
    outbox: simulatorState.outbox.slice(-50).reverse(),
  });
});

const Body = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("customerMessage"),
    customerName: z.string().min(1),
    text: z.string().optional(),
    kind: z.enum(["text", "image", "video", "sticker"]).default("text"),
    avatar: z.boolean().default(true),
  }),
  z.object({ action: z.literal("nativeReply"), customerName: z.string().min(1), text: z.string().min(1) }),
  z.object({
    action: z.literal("settings"),
    rejectWith: z.enum(["window_expired", "disconnected", "rate_limited", "rejected", "unknown"]).nullable(),
  }),
]);

export const POST = route(async (req) => {
  if (!simulatorEnabled()) throw notFound();
  await requireUser(req);
  const body = await parseBody(req, Body);

  if (body.action === "settings") {
    simulatorState.rejectWith = body.rejectWith;
    return Response.json({ ok: true });
  }

  const threadId = `sim-${slug(body.customerName)}`;
  const id = `sim-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const sentAt = new Date().toISOString();
  let event: Record<string, unknown>;
  if (body.action === "nativeReply") {
    event = { type: "echo", threadId, messageId: id, text: body.text, sentAt };
  } else {
    if (!simulatorState.profiles.has(threadId)) {
      simulatorState.profiles.set(threadId, { name: body.customerName, avatar: body.avatar });
    }
    event = { type: "message", threadId, messageId: id, customerName: body.customerName, sentAt };
    if (body.kind === "text") event.text = body.text ?? "";
    else if (body.kind === "image") event.attachment = { type: "image", ref: `sim://image/${id}` };
    else event.attachment = { type: body.kind };
  }
  const raw = simulatorPayload([event]);
  const status = await receiveWebhook(
    "simulator",
    new Headers({ "x-simulator-signature": signSimulator(raw) }),
    raw,
  );
  return Response.json({ ok: status === 200, status });
});
