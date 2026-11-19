import { z } from "zod";
import { requireOwner, requireUser } from "@/server/auth/guards";
import { addStaff } from "@/server/auth/users";
import { prisma } from "@/server/db";
import { parseBody, route } from "@/server/http";

/** Người dùng đang hoạt động, để hiện tên và chọn người phụ trách. */
export const GET = route(async (req) => {
  await requireUser(req);
  const items = await prisma.user.findMany({
    where: { active: true },
    select: { id: true, name: true, email: true, role: true },
    orderBy: [{ role: "asc" }, { createdAt: "asc" }],
  });
  return Response.json({ items });
});

const Body = z.object({ email: z.string().max(320) });

/** Chủ thêm nhân viên bằng địa chỉ Gmail. */
export const POST = route(async (req) => {
  await requireOwner(req);
  const { email } = await parseBody(req, Body);
  return Response.json(await addStaff(email), { status: 201 });
});
