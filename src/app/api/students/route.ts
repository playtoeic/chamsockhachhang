import { z } from "zod";
import { requireUser } from "@/server/auth/guards";
import { parseBody, parseValue, route } from "@/server/http";
import { createStudent, listStudents } from "@/server/students/students";
import { STEP_KEYS } from "@/lib/steps";

const STATUS = z.enum(["considering", "trialed", "enrolled", "dropped"]);

const Query = z.object({
  status: STATUS.optional(),
  pendingStep: z.enum(STEP_KEYS).optional(),
  q: z.string().optional(),
});

export const GET = route(async (req) => {
  await requireUser(req);
  const q = parseValue(Object.fromEntries(new URL(req.url).searchParams), Query);
  return Response.json({ items: await listStudents(q) });
});

const Body = z.object({
  name: z.string().max(200),
  source: z.string().max(100).nullish(),
  note: z.string().max(2000).nullish(),
  conversationId: z.string().min(1).optional(),
});

/** Tạo hồ sơ học sinh thủ công (FR-012a). */
export const POST = route(async (req) => {
  await requireUser(req);
  const body = await parseBody(req, Body);
  return Response.json(await createStudent(body), { status: 201 });
});
