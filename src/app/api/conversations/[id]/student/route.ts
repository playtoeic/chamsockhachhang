import { z } from "zod";
import { requireUser } from "@/server/auth/guards";
import { parseBody, route } from "@/server/http";
import { linkConversation } from "@/server/students/students";

type Ctx = { params: Promise<{ id: string }> };

const Body = z.object({ studentId: z.string().min(1).nullable() });

/** Gắn hoặc bỏ gắn học sinh; hồ sơ tự tạo cũ còn trống bị xoá (FR-012b). */
export const PUT = route<Ctx>(async (req, ctx) => {
  await requireUser(req);
  const { id } = await ctx.params;
  const { studentId } = await parseBody(req, Body);
  return Response.json(await linkConversation(id, studentId));
});
