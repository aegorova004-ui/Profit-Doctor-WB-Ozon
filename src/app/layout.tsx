import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Profit Doctor WB/Ozon — прибыль по каждому товару",
    template: "%s · Profit Doctor",
  },
  description:
    "Загрузите отчёт Wildberries или Ozon и найдите товары, которые съедают прибыль. Прототип сервиса юнит-экономики для селлеров.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" data-scroll-behavior="smooth">
      <body>{children}</body>
    </html>
  );
}
