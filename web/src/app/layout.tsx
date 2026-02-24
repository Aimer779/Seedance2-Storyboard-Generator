import type { Metadata } from "next";
import "./globals.css";
import AntdProvider from "@/components/AntdProvider";

export const metadata: Metadata = {
  title: "Seedance 分镜工作台",
  description: "Seedance 2.0 AI 视频制作工作台 - 剧本/素材/分镜管理",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body style={{ margin: 0, background: '#f5f5f5' }}>
        <AntdProvider>{children}</AntdProvider>
      </body>
    </html>
  );
}
