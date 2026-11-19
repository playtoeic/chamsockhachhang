import { describe, expect, it } from "vitest";
import { initials } from "@/lib/initials";

describe("initials", () => {
  it("lấy chữ đầu của từ đầu và từ cuối", () => {
    expect(initials("Nguyễn Văn An")).toBe("NA");
    expect(initials("  lê   chi ")).toBe("LC");
  });
  it("một từ thì một chữ; tên trống thì '?'", () => {
    expect(initials("Minh")).toBe("M");
    expect(initials("")).toBe("?");
    expect(initials(null)).toBe("?");
  });
  it("giữ dấu tiếng Việt", () => {
    expect(initials("Đặng Ước")).toBe("ĐƯ");
  });
});
