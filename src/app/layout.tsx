import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Hộp thư trung tâm",
  description: "Hộp thư hợp nhất và theo dõi tuyển sinh",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
