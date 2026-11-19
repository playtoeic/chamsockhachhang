// Đo hiệu năng ở quy mô SC-009 và độ trễ xử lý tin đến (SC-001), trên cơ sở dữ liệu riêng.
// Dùng: npx tsx scripts/perf.ts   (cần PostgreSQL dev đang chạy: npm run db:local)
import { execSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import os from "node:os";
import path from "node:path";

const BASE =
  process.env.PERF_DATABASE_URL ?? "postgresql://postgres:postgres@localhost:54329/postgres";
const PERF_URL = BASE.replace(/\/[^/]*$/, "/inbox_perf");

Object.assign(process.env, {
  DATABASE_URL: PERF_URL,
  NODE_ENV: "test",
  ENABLE_SIMULATOR: "true",
  SIMULATOR_SECRET: "perf",
  OWNER_EMAIL: "owner@test.local",
  CREDENTIALS_KEY: Buffer.alloc(32, 3).toString("base64"),
  UPLOAD_DIR: path.join(os.tmpdir(), "inbox-perf-uploads"),
});

const { PrismaClient } = await import("@prisma/client");
const admin = new PrismaClient({ datasources: { db: { url: BASE } } });
await admin.$executeRawUnsafe(`DROP DATABASE IF EXISTS inbox_perf WITH (FORCE)`);
await admin.$executeRawUnsafe(`CREATE DATABASE inbox_perf`);
await admin.$disconnect();
execSync("npx prisma migrate deploy", { env: process.env, stdio: "ignore" });

const { prisma } = await import("../src/server/db");
const { seed } = await import("./seed");
const t0 = Date.now();
const { owner } = await seed(prisma);
console.log(`Sinh dữ liệu: ${((Date.now() - t0) / 1000).toFixed(1)} giây`);
const counts = {
  users: await prisma.user.count(),
  conversations: await prisma.conversation.count(),
  messages: await prisma.message.count(),
  students: await prisma.student.count(),
};
console.log("Quy mô:", counts);

const token = randomBytes(16).toString("hex");
await prisma.session.create({
  data: { sessionToken: token, userId: owner.id, expires: new Date(Date.now() + 3600_000) },
});
const cookie = `authjs.session-token=${token}`;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Handler = (req: Request, ctx: any) => Promise<Response>;
async function time(name: string, handler: Handler, url: string, runs = 5) {
  const ms: number[] = [];
  for (let i = 0; i < runs; i++) {
    const s = performance.now();
    const res = await handler(new Request(url, { headers: { cookie } }), {
      params: Promise.resolve({}),
    });
    await res.text();
    if (res.status !== 200) throw new Error(`${name}: HTTP ${res.status}`);
    ms.push(performance.now() - s);
  }
  ms.sort((a, b) => a - b);
  const median = ms[Math.floor(ms.length / 2)];
  return { name, median: Math.round(median), worst: Math.round(ms[ms.length - 1]) };
}

const { vnToday, weekStart } = await import("../src/lib/slots");
const monday = weekStart(vnToday(new Date()));
const H = "http://localhost";
const results = [
  await time(
    "Tin nhắn: danh sách",
    (await import("../src/app/api/conversations/route")).GET,
    `${H}/api/conversations`,
  ),
  await time(
    "Tin nhắn: lọc chưa đọc",
    (await import("../src/app/api/conversations/route")).GET,
    `${H}/api/conversations?unread=true`,
  ),
  await time(
    "Lịch học thử",
    (await import("../src/app/api/trial-schedule/route")).GET,
    `${H}/api/trial-schedule?week=${monday}`,
  ),
  await time(
    "Lịch xếp học",
    (await import("../src/app/api/class-schedule/route")).GET,
    `${H}/api/class-schedule`,
  ),
  await time(
    "Các bước: danh sách học sinh",
    (await import("../src/app/api/students/route")).GET,
    `${H}/api/students`,
  ),
  await time("Các bước: Q&A", (await import("../src/app/api/qa/route")).GET, `${H}/api/qa`),
];
console.log("\nThời gian phản hồi API (ms, trung vị / chậm nhất của 5 lần):");
for (const r of results)
  console.log(`  ${r.name.padEnd(32)} ${String(r.median).padStart(5)} / ${r.worst}`);

// SC-001: gửi dồn 200 webhook, đo từ lúc nhận tới lúc phát conversation.updated.
await import("../src/server/init");
const { receiveWebhook } = await import("../src/server/inbox/receive");
const { signSimulator, simulatorPayload } = await import("../src/server/channels/simulator");
const { encrypt } = await import("../src/server/crypto");
await prisma.channelConnection.create({
  data: {
    platform: "simulator",
    externalAccountId: "sim-account",
    displayName: "Giả lập",
    credentials: encrypt(JSON.stringify({ token: "x" })),
  },
});
const lat: number[] = [];
const burstStart = performance.now();
await Promise.all(
  Array.from({ length: 200 }, async (_, i) => {
    const raw = simulatorPayload([
      {
        type: "message",
        threadId: `burst-${i % 50}`,
        messageId: `burst-m-${i}`,
        text: `Tin ${i}`,
        sentAt: new Date().toISOString(),
      },
    ]);
    const s = performance.now();
    await receiveWebhook(
      "simulator",
      new Headers({ "x-simulator-signature": signSimulator(raw) }),
      raw,
    );
    lat.push(performance.now() - s);
  }),
);
lat.sort((a, b) => a - b);
const p95 = lat[Math.floor(lat.length * 0.95)];
console.log(
  `\nSC-001: 200 webhook đồng thời xử lý xong trong ${Math.round(performance.now() - burstStart)} ms; ` +
    `p95 mỗi tin ${Math.round(p95)} ms (ngưỡng 60 000 ms)`,
);

const slow = results.filter((r) => r.worst > 2000);
await prisma.$disconnect();
if (slow.length || p95 > 60_000) {
  console.error("KHÔNG ĐẠT:", slow.map((r) => r.name).join(", ") || "SC-001");
  process.exit(1);
}
console.log("\nĐẠT: mọi mục dưới 2 giây (SC-009) và p95 dưới 1 phút (SC-001).");
