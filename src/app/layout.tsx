import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "bubble memo",
  description: "노션 데이터베이스와 연결된 메모 서비스",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
