import { z } from "zod";
import { requireUser } from "@/server/auth/guards";
import { parseValue, route } from "@/server/http";
import { listConversations } from "@/server/inbox/conversations";

const Query = z.object({
  platform: z.enum(["facebook", "instagram", "zalo", "simulator"]).optional(),
  unread: z.enum(["true", "false"]).optional(),
  assignee: z.string().min(1).optional(),
  q: z.string().optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export const GET = route(async (req) => {
  const user = await requireUser(req);
  const params = Object.fromEntries(new URL(req.url).searchParams);
  const q = parseValue(params, Query);
  return Response.json(
    await listConversations(user, {
      ...q,
      unread: q.unread === undefined ? undefined : q.unread === "true",
    }),
  );
});
