// Sinh dữ liệu giả lập ở quy mô SC-009 (dữ liệu tự tạo, không phải khách thật).
// Dùng: DATABASE_URL=... npx tsx scripts/seed.ts
import type {
  ChannelConnection,
  PrismaClient,
  Slot,
  Step,
  StudentStatus,
  User,
} from "@prisma/client";
import { encrypt } from "../src/server/crypto";

const HO = [
  "Nguyễn",
  "Trần",
  "Lê",
  "Phạm",
  "Hoàng",
  "Huỳnh",
  "Phan",
  "Vũ",
  "Võ",
  "Đặng",
  "Bùi",
  "Đỗ",
];
const DEM = ["Văn", "Thị", "Minh", "Ngọc", "Thu", "Gia", "Hữu", "Thanh", "Bảo", "Khánh"];
const TEN = [
  "An",
  "Bình",
  "Chi",
  "Dũng",
  "Giang",
  "Hà",
  "Khoa",
  "Linh",
  "My",
  "Nam",
  "Phúc",
  "Quân",
  "Trang",
  "Vy",
];
const SLOTS: Slot[] = ["S1", "S2", "S3", "S4"];
const STEPS: Step[] = [
  "trial_scheduled",
  "class_scheduled",
  "entry_test",
  "tuition_paid",
  "commitment_signed",
];
const STATUSES: StudentStatus[] = [
  "considering",
  "considering",
  "considering",
  "trialed",
  "enrolled",
  "dropped",
];

const pick = <T>(arr: T[], i: number) => arr[i % arr.length];

export async function seed(
  prisma: PrismaClient,
  opts = { users: 10, conversations: 2000, messagesPerConversation: 5 },
) {
  const now = Date.now();
  const users: User[] = [];
  for (let i = 0; i < opts.users; i++) {
    users.push(
      await prisma.user.create({
        data: {
          email: i === 0 ? "owner@test.local" : `nhanvien${i}@example.test`,
          name: i === 0 ? "Chủ trung tâm" : `Nhân viên ${i}`,
          role: i === 0 ? "owner" : "staff",
        },
      }),
    );
  }
  const platforms = ["facebook", "instagram", "zalo"] as const;
  const conns: ChannelConnection[] = [];
  for (const p of platforms) {
    conns.push(
      await prisma.channelConnection.create({
        data: {
          platform: p,
          externalAccountId: `${p}-acct`,
          displayName: `Trang ${p}`,
          credentials: encrypt(JSON.stringify({ token: "seed" })),
        },
      }),
    );
  }

  const BATCH = 200;
  for (let start = 0; start < opts.conversations; start += BATCH) {
    const n = Math.min(BATCH, opts.conversations - start);
    const students = Array.from({ length: n }, (_, k) => {
      const i = start + k;
      const lastAt = new Date(now - i * 7 * 60_000);
      return {
        id: `seed-s-${i}`,
        name: `${pick(HO, i)} ${pick(DEM, i * 7)} ${pick(TEN, i * 13)}`,
        source: ["Facebook", "Instagram", "Zalo"][i % 3],
        autoCreated: true,
        status: pick(STATUSES, i),
        lastActivityAt: lastAt,
      };
    });
    await prisma.student.createMany({ data: students });
    await prisma.conversation.createMany({
      data: students.map((s, k) => ({
        id: `seed-c-${start + k}`,
        channelConnectionId: conns[(start + k) % 3].id,
        externalThreadId: `seed-t-${start + k}`,
        customerName: s.name,
        studentId: s.id,
        unread: (start + k) % 4 === 0,
        assigneeUserId: (start + k) % 3 === 0 ? users[(start + k) % users.length].id : null,
        lastMessageAt: s.lastActivityAt,
        lastInboundAt: s.lastActivityAt,
      })),
    });
    await prisma.message.createMany({
      data: students.flatMap((s, k) =>
        Array.from({ length: opts.messagesPerConversation }, (_, m) => ({
          conversationId: `seed-c-${start + k}`,
          direction: m % 2 === 0 ? ("inbound" as const) : ("outbound" as const),
          kind: "text" as const,
          body: m % 2 === 0 ? `Khách hỏi lần ${m + 1}` : `Trung tâm trả lời lần ${m + 1}`,
          status: m % 2 === 0 ? ("received" as const) : ("sent" as const),
          sentByUserId: m % 2 === 0 ? null : users[(start + k + m) % users.length].id,
          externalMessageId: `seed-m-${start + k}-${m}`,
          createdAt: new Date(
            s.lastActivityAt.getTime() - (opts.messagesPerConversation - m) * 60_000,
          ),
        })),
      ),
    });
    await prisma.stepProgress.createMany({
      data: students.flatMap((s, k) =>
        STEPS.slice(0, (start + k) % 6).map((step) => ({
          studentId: s.id,
          step,
          done: true,
          doneAt: new Date(),
        })),
      ),
    });
  }

  // Lịch học thử trong 3 tuần quanh hôm nay và lịch học cho một phần học sinh.
  const day = (offset: number) => {
    const d = new Date(now + offset * 86400_000);
    while (d.getUTCDay() === 0) d.setUTCDate(d.getUTCDate() + 1);
    return new Date(`${d.toISOString().slice(0, 10)}T00:00:00.000Z`);
  };
  await prisma.trialBooking.createMany({
    data: Array.from({ length: 300 }, (_, i) => ({
      studentId: `seed-s-${i * 3}`,
      date: day((i % 21) - 7),
      slot: pick(SLOTS, i),
    })),
  });
  await prisma.classAssignment.createMany({
    data: Array.from({ length: 400 }, (_, i) => ({
      studentId: `seed-s-${i * 4 + 1}`,
      weekday: (i % 6) + 1,
      slot: pick(SLOTS, i * 5),
    })),
    skipDuplicates: true,
  });
  await prisma.qaEntry.createMany({
    data: Array.from({ length: 50 }, (_, i) => ({
      question: `Câu hỏi thường gặp số ${i + 1}?`,
      answer: `Câu trả lời mẫu số ${i + 1}.`,
    })),
  });
  return { owner: users[0] };
}

if (process.argv[1]?.endsWith("seed.ts")) {
  const { PrismaClient } = await import("@prisma/client");
  const prisma = new PrismaClient();
  await seed(prisma);
  console.log("Đã sinh dữ liệu.");
  await prisma.$disconnect();
}
