import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RADAR — задачи встречают талант",
  description: "Двусторонняя платформа реальных бизнес-задач и измеримого роста навыков студентов.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ru" className="h-full antialiased">
      <body>{children}</body>
    </html>
  );
}
