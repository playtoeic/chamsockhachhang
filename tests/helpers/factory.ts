import type { Platform } from "@prisma/client";
import { prisma } from "@/server/db";
import { encrypt } from "@/server/crypto";

export async function createConnection(platform: Platform = "simulator", externalAccountId = "sim-account") {
  return prisma.channelConnection.create({
    data: {
      platform,
      externalAccountId,
      displayName: `Trang ${platform}`,
      status: "connected",
      credentials: encrypt(JSON.stringify({ token: "test" })),
    },
  });
}

export async function createConversation(
  connectionId: string,
  data: Partial<{
    externalThreadId: string;
    customerName: string;
    lastMessageAt: Date;
    unread: boolean;
    assigneeUserId: string | null;
    studentId: string | null;
    lastInboundAt: Date | null;
  }> = {},
) {
  return prisma.conversation.create({
    data: {
      channelConnectionId: connectionId,
      externalThreadId: data.externalThreadId ?? `t-${Math.random().toString(36).slice(2)}`,
      customerName: data.customerName ?? "Khách",
      lastMessageAt: data.lastMessageAt ?? new Date(),
      unread: data.unread ?? false,
      assigneeUserId: data.assigneeUserId ?? null,
      studentId: data.studentId ?? null,
      lastInboundAt: data.lastInboundAt ?? new Date(),
    },
  });
}

export async function createStudent(
  data: Partial<{ name: string; source: string; autoCreated: boolean; status: "considering" | "trialed" | "enrolled" | "dropped"; lastActivityAt: Date }> = {},
) {
  return prisma.student.create({
    data: {
      name: data.name ?? "Học sinh",
      source: data.source ?? null,
      autoCreated: data.autoCreated ?? false,
      status: data.status ?? "considering",
      lastActivityAt: data.lastActivityAt ?? new Date(),
    },
  });
}
