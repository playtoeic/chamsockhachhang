/** Chữ cái đầu để thay ảnh đại diện: chữ đầu của từ đầu và từ cuối ("Nguyễn Văn An" → "NA"). */
export function initials(name: string | null | undefined): string {
  const words = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  const first = words[0][0];
  const last = words.length > 1 ? words[words.length - 1][0] : "";
  return (first + last).toLocaleUpperCase("vi");
}
