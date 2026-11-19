import { readdirSync, statSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * FR-029, SC-008: mọi route API (trừ đăng nhập, webhook của nền tảng và công cụ dev) phải từ chối
 * yêu cầu không có phiên bằng 401. Test tự quét thư mục, nên route thêm về sau cũng được kiểm.
 */
const API_DIR = path.resolve("src/app/api");
const EXCLUDED = ["auth", "webhooks", "dev"];
const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;

function findRoutes(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return findRoutes(full);
    return name === "route.ts" ? [full] : [];
  });
}

const routes = findRoutes(API_DIR).filter((file) => {
  const first = path.relative(API_DIR, file).split(path.sep)[0];
  return !EXCLUDED.includes(first);
});

function fakeParams(file: string) {
  const params: Record<string, string | string[]> = {};
  for (const seg of path.relative(API_DIR, path.dirname(file)).split(path.sep)) {
    const m = seg.match(/^\[(\.\.\.)?(.+)\]$/);
    if (m) params[m[2]] = m[1] ? ["x"] : seg === "[weekday]" ? "1" : "x";
  }
  return params;
}

describe("mọi route API yêu cầu đăng nhập", () => {
  it("tìm thấy route để kiểm", () => {
    expect(routes.length).toBeGreaterThan(0);
  });

  for (const file of routes) {
    const rel = path.relative(API_DIR, file).replaceAll(path.sep, "/");
    it(`/api/${rel}`, async () => {
      const mod = await import(pathToFileURL(file).href);
      const exported = METHODS.filter((m) => typeof mod[m] === "function");
      expect(exported.length).toBeGreaterThan(0);
      for (const method of exported) {
        const req = new Request(`http://localhost/api/${rel}`, {
          method,
          body: method === "GET" || method === "DELETE" ? undefined : "{}",
        });
        const res: Response = await mod[method](req, { params: Promise.resolve(fakeParams(file)) });
        expect(res.status, `${method} /api/${rel}`).toBe(401);
      }
    });
  }
});
