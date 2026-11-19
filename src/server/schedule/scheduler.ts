/**
 * Chạy `fn` mỗi phút trong tiến trình (research.md R6). Lỗi của một lần chạy được ghi lại và không
 * dừng các lần sau; không chạy chồng khi lần trước chưa xong. Trả hàm dừng.
 */
export function startEveryMinute(fn: () => unknown, intervalMs = 60_000): () => void {
  let running = false;
  const timer = setInterval(async () => {
    if (running) return;
    running = true;
    try {
      await fn();
    } catch (e) {
      console.error("[scheduler] lần chạy bị lỗi", e);
    } finally {
      running = false;
    }
  }, intervalMs);
  return () => clearInterval(timer);
}
