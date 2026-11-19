import { requireUser } from "@/server/auth/guards";
import { notFound, route, validation } from "@/server/http";
import { isSafeMediaName, readMedia } from "@/server/inbox/media";

type Ctx = { params: Promise<{ name: string }> };

/** Trả ảnh đã lưu (ảnh khách gửi, ảnh đại diện) cho người đã đăng nhập (FR-029). */
export const GET = route<Ctx>(async (req, ctx) => {
  await requireUser(req);
  const { name } = await ctx.params;
  if (!isSafeMediaName(decodeURIComponent(name))) throw validation("Tên tệp không hợp lệ");
  const file = await readMedia(name);
  if (!file) throw notFound("Ảnh");
  return new Response(new Uint8Array(file.data), {
    headers: {
      "Content-Type": file.contentType,
      "Cache-Control": "private, max-age=86400",
      "X-Content-Type-Options": "nosniff",
    },
  });
});
