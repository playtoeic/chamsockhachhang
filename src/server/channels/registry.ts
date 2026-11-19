import type { Platform } from "@prisma/client";
import { facebook } from "./facebook";
import { instagram } from "./instagram";
import { simulator } from "./simulator";
import type { ChannelAdapter } from "./types";
import { zalo } from "./zalo";

const adapters: Partial<Record<Platform, ChannelAdapter>> = { facebook, instagram, zalo };

export function registerAdapter(adapter: ChannelAdapter): void {
  adapters[adapter.platform] = adapter;
}

export const simulatorEnabled = () => process.env.ENABLE_SIMULATOR === "true";

/** Adapter của một nền tảng; trống nếu nền tảng không thuộc danh sách hoặc bị tắt. */
export function getAdapter(platform: string): ChannelAdapter | undefined {
  if (platform === "simulator") return simulatorEnabled() ? simulator : undefined;
  return adapters[platform as Platform];
}

/** Các nền tảng hiện trên trang Kênh, theo thứ tự hiển thị. */
export function listPlatforms(): ChannelAdapter[] {
  const order: Platform[] = ["facebook", "instagram", "zalo"];
  const list = order.map((p) => adapters[p]).filter((a): a is ChannelAdapter => !!a);
  return simulatorEnabled() ? [...list, simulator] : list;
}

const LABELS: Record<Platform, string> = {
  facebook: "Facebook",
  instagram: "Instagram",
  zalo: "Zalo",
  simulator: "Giả lập",
};

/** Tên kênh, cũng là nguồn ghi trên hồ sơ học sinh tự tạo (data-model.md, Student.source). */
export function platformLabel(platform: Platform): string {
  return LABELS[platform];
}
