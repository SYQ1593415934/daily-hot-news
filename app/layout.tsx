import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "今日热闻", description: "聚合国内平台热点，了解事件来龙去脉。" };
export default function RootLayout({children}:{children: React.ReactNode}) { return <html lang="zh-CN"><body className="antialiased bg-white text-[#202020]">{children}</body></html>; }
