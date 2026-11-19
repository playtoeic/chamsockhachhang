import { describe, expect, it } from "vitest";
import { prisma } from "@/server/db";
import { publish } from "@/server/events/bus";
import { GET } from "@/app/api/events/route";
import { createSession } from "../helpers/session";

const ctx = { params: Promise.resolve({}) };

async function open(cookie?: string) {
  const ac = new AbortController();
  const res = await GET(
    new Request("http://localhost/api/events", {
      headers: cookie ? { cookie } : {},
      signal: ac.signal,
    }),
    ctx,
  );
  return { res, ac };
}

/** Đọc luồng cho tới khi gặp chuỗi cần tìm hoặc hết thời gian. */
async function readUntil(res: Response, needle: string, ms = 2000): Promise<string> {
  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let text = "";
  const deadline = Date.now() + ms;
  while (Date.now() < deadline && !text.includes(needle)) {
    const chunk = await Promise.race([
      reader.read(),
      new Promise<{ done: true; value: undefined }>((r) =>
        setTimeout(() => r({ done: true, value: undefined }), deadline - Date.now()),
      ),
    ]);
    if (chunk.done) break;
    text += decoder.decode(chunk.value);
  }
  reader.releaseLock();
  return text;
}

describe("GET /api/events", () => {
  it("không có phiên thì 401", async () => {
    const { res } = await open();
    expect(res.status).toBe(401);
  });

  it("đẩy sự kiện tới trình duyệt theo định dạng SSE", async () => {
    const { cookie } = await createSession(prisma, { email: "nv@gmail.com" });
    const { res, ac } = await open(cookie);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/event-stream");
    setTimeout(() => publish("student.updated", { studentId: "s1" }), 50);
    const text = await readUntil(res, "s1");
    expect(text).toContain("event: student.updated");
    expect(text).toContain('data: {"studentId":"s1"}');
    ac.abort();
  });

  it("session.revoked chỉ gửi cho đúng người bị gỡ", async () => {
    const a = await createSession(prisma, { email: "a@gmail.com" });
    const b = await createSession(prisma, { email: "b@gmail.com" });
    const sa = await open(a.cookie);
    const sb = await open(b.cookie);
    setTimeout(() => {
      publish("session.revoked", {}, { toUserId: a.user.id });
      publish("qa.updated", {});
    }, 50);
    const textA = await readUntil(sa.res, "qa.updated");
    const textB = await readUntil(sb.res, "qa.updated");
    expect(textA).toContain("event: session.revoked");
    expect(textB).not.toContain("session.revoked");
    sa.ac.abort();
    sb.ac.abort();
  });
});
