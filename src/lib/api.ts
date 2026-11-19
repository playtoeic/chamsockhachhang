"use client";

export class ClientApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

/** Gọi API nội bộ; lỗi ném ClientApiError với thông báo tiếng Việt từ máy chủ. */
export async function api<T = unknown>(
  path: string,
  opts: { method?: string; body?: unknown } = {},
): Promise<T> {
  const res = await fetch(path, {
    method: opts.method ?? "GET",
    headers: opts.body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    cache: "no-store",
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    // Phiên đã mất: tải lại hẳn trang đăng nhập để xoá mọi trạng thái phía trình duyệt.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    if (res.status === 401 && typeof window !== "undefined") window.location.assign("/login");
    throw new ClientApiError(
      res.status,
      data?.error?.code ?? "error",
      data?.error?.message ?? "Có lỗi xảy ra, vui lòng thử lại",
    );
  }
  return data as T;
}
