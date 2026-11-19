import { describe, expect, it } from "vitest";
import { decrypt, encrypt } from "@/server/crypto";

describe("crypto", () => {
  it("mã hoá rồi giải mã trả lại nguyên văn", () => {
    const secret = JSON.stringify({ pageToken: "EAAB…xyz", ünicode: "tiếng Việt" });
    const box = encrypt(secret);
    expect(box).not.toContain("EAAB");
    expect(decrypt(box)).toBe(secret);
  });

  it("hai lần mã hoá cùng nội dung cho kết quả khác nhau", () => {
    expect(encrypt("a")).not.toBe(encrypt("a"));
  });

  it("khoá sai thì lỗi", () => {
    const box = encrypt("bí mật");
    const other = Buffer.alloc(32, 9).toString("base64");
    expect(() => decrypt(box, other)).toThrow();
  });

  it("dữ liệu bị sửa thì lỗi", () => {
    const box = encrypt("bí mật");
    const [iv, tag, data] = box.split(".");
    const tampered = [iv, tag, Buffer.from("x" + Buffer.from(data, "base64").toString()).toString("base64")].join(".");
    expect(() => decrypt(tampered)).toThrow();
  });

  it("khoá không đủ 32 byte thì lỗi", () => {
    expect(() => encrypt("a", Buffer.alloc(16).toString("base64"))).toThrow(/32 byte/);
  });
});
