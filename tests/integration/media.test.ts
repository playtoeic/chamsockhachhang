import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/server/db";
import { GET } from "@/app/api/media/[name]/route";
import { call } from "../helpers/http";
import { createSession } from "../helpers/session";

let cookie: string;
const PNG = Buffer.from("89504e470d0a1a0a", "hex");

beforeEach(async () => {
  cookie = (await createSession(prisma, { email: "lan@gmail.com" })).cookie;
  mkdirSync(process.env.UPLOAD_DIR!, { recursive: true });
  writeFileSync(path.join(process.env.UPLOAD_DIR!, "abc-123.png"), PNG);
});

describe("GET /api/media/{name}", () => {
  it("người đã đăng nhập nhận đúng ảnh với Cache-Control: private", async () => {
    const res = await GET(
      new Request("http://localhost/api/media/abc-123.png", { headers: { cookie } }),
      {
        params: Promise.resolve({ name: "abc-123.png" }),
      },
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/png");
    expect(res.headers.get("cache-control")).toContain("private");
    expect(Buffer.from(await res.arrayBuffer()).equals(PNG)).toBe(true);
  });

  it("tên chứa '..' hoặc '/' bị từ chối", async () => {
    for (const name of ["../secret.png", "..", "a/b.png", "..%2Fx"]) {
      const res = await call(GET, { cookie, params: { name } });
      expect(res.status, name).toBe(400);
    }
  });

  it("tên không tồn tại trả 404", async () => {
    const res = await call(GET, { cookie, params: { name: "khong-co.png" } });
    expect(res.status).toBe(404);
  });
});
