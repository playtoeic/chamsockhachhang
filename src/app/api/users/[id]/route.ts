import { requireOwner } from "@/server/auth/guards";
import { removeStaff } from "@/server/auth/users";
import { route } from "@/server/http";

type Ctx = { params: Promise<{ id: string }> };

/** Chủ gỡ nhân viên; có hiệu lực ngay (FR-010). */
export const DELETE = route<Ctx>(async (req, ctx) => {
  await requireOwner(req);
  const { id } = await ctx.params;
  await removeStaff(id);
  return Response.json({ ok: true });
});
