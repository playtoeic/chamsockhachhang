import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/server/db";
import { signSimulator, simulatorState } from "@/server/channels/simulator";
import { subscribe, type AppEvent } from "@/server/events/bus";
import { POST } from "@/app/api/webhooks/[platform]/route";
import { createConnection } from "../helpers/factory";

async function webhook(events: Record<string, unknown>[]) {
  const raw = JSON.stringify({ accountId: "sim-account", events });
  await POST(
    new Request("http://localhost/api/webhooks/simulator", {
      method: "POST",
      headers: { "x-simulator-signature": signSimulator(raw) },
      body: raw,
    }),
    { params: Promise.resolve({ platform: "simulator" }) },
  );
}

const msg = (id: string, sentAt: string, threadId = "t1") => ({
  type: "message",
  threadId,
  messageId: id,
  text: "Xin chào",
  sentAt,
});

beforeEach(async () => {
  simulatorState.reset();
  simulatorState.profiles.set("t1", { name: "Nguyễn Văn An", avatar: true });
  await createConnection();
});

describe("tự tạo hồ sơ học sinh cho khách mới (FR-012)", () => {
  it("tin đầu tiên của cuộc trò chuyện mới tạo hồ sơ 'đang tham khảo' gắn với cuộc trò chuyện", async () => {
    const events: AppEvent[] = [];
    const unsub = subscribe((e) => events.push(e));
    await webhook([msg("m1", "2026-11-16T03:00:00Z")]);
    unsub();

    const conv = await prisma.conversation.findFirstOrThrow();
    const student = await prisma.student.findFirstOrThrow();
    expect(student).toMatchObject({
      name: "Nguyễn Văn An",
      source: "Giả lập",
      status: "considering",
      statusSource: "manual",
      autoCreated: true,
      avatarPath: conv.customerAvatarPath,
    });
    expect(student.avatarPath).toBeTruthy();
    expect(conv.studentId).toBe(student.id);
    expect(events).toContainEqual(expect.objectContaining({ type: "student.updated", data: { studentId: student.id } }));
  });

  it("tin thứ hai cùng cuộc trò chuyện không tạo thêm hồ sơ và cập nhật lastActivityAt", async () => {
    await webhook([msg("m1", "2026-11-16T03:00:00Z")]);
    await webhook([msg("m2", "2026-11-16T05:00:00Z")]);
    expect(await prisma.student.count()).toBe(1);
    const s = await prisma.student.findFirstOrThrow();
    expect(s.lastActivityAt.toISOString()).toBe("2026-11-16T05:00:00.000Z");
  });

  it("xoá hồ sơ rồi khách nhắn tiếp thì không tạo lại", async () => {
    await webhook([msg("m1", "2026-11-16T03:00:00Z")]);
    await prisma.student.deleteMany();
    await webhook([msg("m2", "2026-11-16T05:00:00Z")]);
    expect(await prisma.student.count()).toBe(0);
    expect((await prisma.conversation.findFirstOrThrow()).studentId).toBeNull();
  });

  it("mỗi cuộc trò chuyện mới có hồ sơ riêng", async () => {
    await webhook([msg("m1", "2026-11-16T03:00:00Z", "t1"), msg("m2", "2026-11-16T03:01:00Z", "t2")]);
    expect(await prisma.student.count()).toBe(2);
  });
});
