import { PLATFORMS, type PlatformKey } from "@/lib/platforms";

export function PlatformBadge({ platform }: { platform: PlatformKey }) {
  const p = PLATFORMS[platform];
  return (
    <span className="badge" style={{ background: p.color }} title={p.label} aria-label={`Kênh ${p.label}`}>
      {p.short}
    </span>
  );
}
