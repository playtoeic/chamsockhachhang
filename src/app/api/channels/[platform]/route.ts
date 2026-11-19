import { requireOwner } from "@/server/auth/guards";
import { disconnect } from "@/server/channels/connections";
import { route } from "@/server/http";

// Next.js bắt buộc cùng một tên tham số ở cùng cấp đường dẫn với connect/callback, nên tham số
// tên là `platform` nhưng ở đây mang id của kết nối: DELETE /api/channels/{id}.
type Ctx = { params: Promise<{ platform: string }> };

export const DELETE = route<Ctx>(async (req, ctx) => {
  await requireOwner(req);
  const { platform: id } = await ctx.params;
  await disconnect(id);
  return Response.json({ ok: true });
});
