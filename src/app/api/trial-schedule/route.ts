import { z } from "zod";
import { requireUser } from "@/server/auth/guards";
import { parseValue, route } from "@/server/http";
import { getWeek } from "@/server/schedule/trial";

const Query = z.object({
  week: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "week phải có dạng YYYY-MM-DD"),
  q: z.string().optional(),
});

/** Lịch học thử một tuần (week = ngày thứ 2) và danh sách học sinh chưa có buổi. */
export const GET = route(async (req) => {
  await requireUser(req);
  const { week, q } = parseValue(Object.fromEntries(new URL(req.url).searchParams), Query);
  return Response.json(await getWeek(week, q));
});
