import { initials } from "@/lib/initials";

/** Ảnh đại diện; không có ảnh thì hiện chữ cái đầu của tên (FR-004b). */
export function Avatar({ name, url, size = 32 }: { name: string; url: string | null; size?: number }) {
  const style = { width: size, height: size, fontSize: size * 0.4 };
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img className="avatar" src={url} alt={`Ảnh đại diện ${name}`} style={style} />;
  }
  return (
    <span className="avatar initials" style={style} aria-label={`Chữ cái đầu của ${name}`}>
      {initials(name)}
    </span>
  );
}
