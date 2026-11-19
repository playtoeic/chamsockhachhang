import { requireUser } from "@/server/auth/guards";
import { prisma } from "@/server/db";
import { route } from "@/server/http";

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
