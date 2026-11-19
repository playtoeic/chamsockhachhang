import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/** Mã hoá thông tin truy cập kênh khi lưu (AES-256-GCM). Định dạng: iv.tag.data (base64). */

function key(b64 = process.env.CREDENTIALS_KEY): Buffer {
  const k = Buffer.from(b64 ?? "", "base64");
  if (k.length !== 32) throw new Error("CREDENTIALS_KEY phải là 32 byte dạng base64");
  return k;
}

export function encrypt(plain: string, keyB64?: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(keyB64), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, data].map((b) => b.toString("base64")).join(".");
}

export function decrypt(box: string, keyB64?: string): string {
  const [iv, tag, data] = box.split(".").map((p) => Buffer.from(p, "base64"));
  if (!iv || !tag || !data) throw new Error("Dữ liệu mã hoá không hợp lệ");
  const decipher = createDecipheriv("aes-256-gcm", key(keyB64), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}
