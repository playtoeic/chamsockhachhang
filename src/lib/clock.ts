/** Đồng hồ tiêm vào: mọi code phụ thuộc thời gian gọi `clock.now()` để test được (research.md R6, R8). */
let testNow: Date | null = null;

export const clock = {
  now(): Date {
    return testNow ? new Date(testNow.getTime()) : new Date();
  },
};

/** Chỉ dùng trong test. Truyền `null` để quay lại giờ thật. */
export function setTestNow(date: Date | null): void {
  testNow = date ? new Date(date.getTime()) : null;
}
