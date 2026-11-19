import { requireUser } from "@/server/auth/guards";
import { listConnections } from "@/server/channels/connections";
import { route } from "@/server/http";

export const GET = route(async (req) => {
  await requireUser(req);
  return Response.json(await listConnections());
});
