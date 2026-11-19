import type { z } from "zod";

/** Lỗi có chủ đích, trả về trình duyệt dạng `{ error: { code, message } }` (contracts/api.md). */
export class ApiError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export const unauthorized = () => new ApiError("unauthorized", 401, "Bạn cần đăng nhập");
export const forbidden = () => new ApiError("forbidden", 403, "Bạn không có quyền làm việc này");
export const notFound = (what = "Dữ liệu") =>
  new ApiError("not_found", 404, `${what} không tồn tại`);
export const validation = (message = "Dữ liệu không hợp lệ") =>
  new ApiError("validation", 400, message);

export function errorResponse(err: ApiError): Response {
  return Response.json({ error: { code: err.code, message: err.message } }, { status: err.status });
}

type Handler<C> = (req: Request, ctx: C) => Promise<Response>;

/** Bọc route handler: đổi lỗi thành phản hồi JSON đúng hợp đồng. */
export function route<C = unknown>(handler: Handler<C>): Handler<C> {
  return async (req, ctx) => {
    try {
      return await handler(req, ctx);
    } catch (err) {
      if (err instanceof ApiError) return errorResponse(err);
      console.error(err);
      return errorResponse(new ApiError("internal", 500, "Lỗi máy chủ, vui lòng thử lại"));
    }
  };
}

/** Đọc và kiểm tra thân JSON bằng Zod; sai thì ném 400 `validation`. */
export async function parseBody<S extends z.ZodType>(req: Request, schema: S): Promise<z.infer<S>> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw validation("Thân yêu cầu phải là JSON");
  }
  const result = schema.safeParse(raw);
  if (!result.success) {
    const first = result.error.issues[0];
    throw validation(first ? `${first.path.join(".") || "body"}: ${first.message}` : undefined);
  }
  return result.data;
}

/** Kiểm tra một giá trị (tham số đường dẫn, query) bằng Zod; sai thì ném 400 `validation`. */
export function parseValue<S extends z.ZodType>(value: unknown, schema: S): z.infer<S> {
  const result = schema.safeParse(value);
  if (!result.success) throw validation(result.error.issues[0]?.message);
  return result.data;
}
