import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
};
const TYPES: Record<string, string> = Object.fromEntries(
  Object.entries(EXT).map(([t, e]) => [e, t]),
);

export const uploadDir = () => path.resolve(process.env.UPLOAD_DIR ?? "./uploads");

/** Tên tệp hợp lệ: chữ, số, '-', '.', không chứa '..' (contracts/api.md, mục Ảnh). */
export function isSafeMediaName(name: string): boolean {
  return /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(name) && !name.includes("..");
}

/** Lưu bản sao ảnh vào UPLOAD_DIR với tên ngẫu nhiên; trả tên tệp. */
export async function saveMedia(data: Buffer, contentType: string): Promise<string> {
  const ext = EXT[contentType.split(";")[0].trim().toLowerCase()];
  if (!ext) throw new Error(`Loại ảnh không hỗ trợ: ${contentType}`);
  const name = `${randomUUID()}.${ext}`;
  await mkdir(uploadDir(), { recursive: true });
  await writeFile(path.join(uploadDir(), name), data);
  return name;
}

export async function readMedia(
  name: string,
): Promise<{ data: Buffer; contentType: string } | null> {
  if (!isSafeMediaName(name)) return null;
  const ext = name.split(".").pop() ?? "";
  try {
    const data = await readFile(path.join(uploadDir(), name));
    return { data, contentType: TYPES[ext] ?? "application/octet-stream" };
  } catch {
    return null;
  }
}

/** Đường dẫn trả về trình duyệt cho một tệp đã lưu. */
export const mediaUrl = (name: string | null | undefined) => (name ? `/api/media/${name}` : null);
