export type PlatformKey = "facebook" | "instagram" | "zalo" | "simulator";

export const PLATFORMS: Record<PlatformKey, { label: string; short: string; color: string }> = {
  facebook: { label: "Facebook", short: "FB", color: "#1877f2" },
  instagram: { label: "Instagram", short: "IG", color: "#c13584" },
  zalo: { label: "Zalo", short: "ZL", color: "#0068ff" },
  simulator: { label: "Giả lập", short: "GL", color: "#6b7280" },
};
