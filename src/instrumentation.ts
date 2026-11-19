/**
 * Chạy một lần khi máy chủ Next.js khởi động: đăng ký bộ xử lý dùng chung và khởi động tác vụ tự
 * chuyển "đã học thử" mỗi phút (tasks.md T073). Chỉ ở runtime Node; không chạy trong test.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.NODE_ENV === "test") return;
  const g = globalThis as unknown as { __autoMarkStarted?: boolean };
  if (g.__autoMarkStarted) return;
  g.__autoMarkStarted = true;

  await import("@/server/init");
  const [{ startEveryMinute }, { runAutoMark }, { clock }] = await Promise.all([
    import("@/server/schedule/scheduler"),
    import("@/server/schedule/auto-mark"),
    import("@/lib/clock"),
  ]);
  startEveryMinute(() => runAutoMark(clock.now()));
}
