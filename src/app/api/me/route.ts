import { requireUser } from "@/server/auth/guards";
import { route } from "@/server/http";

export const GET = route(async (req) => {
  const { id, email, name, role } = await requireUser(req);
  return Response.json({ id, email, name, role });
});
