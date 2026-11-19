import { requireUser } from "@/server/auth/guards";
import { route } from "@/server/http";
import { getGrid } from "@/server/schedule/classes";

/** Lưới lịch học tuần lặp lại và danh sách học sinh chưa có khung nào. */
export const GET = route(async (req) => {
  await requireUser(req);
  const q = new URL(req.url).searchParams.get("q") ?? undefined;
  return Response.json(await getGrid(q));
});
