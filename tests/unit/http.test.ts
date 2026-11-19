import { describe, expect, it } from "vitest";
import { z } from "zod";
import { ApiError, parseBody, route } from "@/server/http";

const json = (body: unknown) =>
  new Request("http://x/api", { method: "POST", body: JSON.stringify(body) });
const ctx = {};

describe("route()", () => {
  it("trả kết quả của handler", async () => {
    const res = await route(async () => Response.json({ ok: true }))(json({}), ctx);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it("đổi ApiError thành { error: { code, message } } với đúng mã trạng thái", async () => {
    const res = await route(async () => {
      throw new ApiError("forbidden", 403, "Không có quyền");
    })(json({}), ctx);
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: { code: "forbidden", message: "Không có quyền" } });
  });

  it("đổi lỗi lạ thành 500 mà không lộ chi tiết", async () => {
    const res = await route(async () => {
      throw new Error("bí mật nội bộ");
    })(json({}), ctx);
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error.code).toBe("internal");
    expect(JSON.stringify(body)).not.toContain("bí mật");
  });
});

describe("parseBody()", () => {
  const schema = z.object({ name: z.string().min(1) });

  it("trả dữ liệu hợp lệ", async () => {
    expect(await parseBody(json({ name: "An" }), schema)).toEqual({ name: "An" });
  });

  it("dữ liệu sai ném ApiError 400 code validation", async () => {
    await expect(parseBody(json({ name: "" }), schema)).rejects.toMatchObject({
      status: 400,
      code: "validation",
    });
  });

  it("thân không phải JSON ném ApiError 400 code validation", async () => {
    const req = new Request("http://x/api", { method: "POST", body: "{không phải json" });
    await expect(parseBody(req, schema)).rejects.toMatchObject({ status: 400, code: "validation" });
  });
});
