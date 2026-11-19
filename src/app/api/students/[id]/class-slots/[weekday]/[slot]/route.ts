import { z } from "zod";
import { requireUser } from "@/server/auth/guards";
import { parseValue, route } from "@/server/http";
import { addSlot, removeSlot } from "@/server/schedule/classes";
import { SLOT_KEYS } from "@/lib/slots";

type Ctx = { params: Promise<{ id: string; weekday: string; slot: string }> };

const Params = z.object({
  id: z.string().min(1),
  weekday: z.coerce
    .number()
    .int()
    .min(1, "Ngày phải từ thứ 2 tới thứ 7")
    .max(6, "Ngày phải từ thứ 2 tới thứ 7"),
  slot: z.enum(SLOT_KEYS, { message: "Khung giờ không hợp lệ" }),
});

/** Thêm khung; gọi lặp lại không đổi gì. */
export const PUT = route<Ctx>(async (req, ctx) => {
  await requireUser(req);
  const { id, weekday, slot } = parseValue(await ctx.params, Params);
  await addSlot(id, weekday, slot);
  return Response.json({ ok: true });
});

/** Gỡ đúng một khung. */
export const DELETE = route<Ctx>(async (req, ctx) => {
  await requireUser(req);
  const { id, weekday, slot } = parseValue(await ctx.params, Params);
  await removeSlot(id, weekday, slot);
  return Response.json({ ok: true });
});
