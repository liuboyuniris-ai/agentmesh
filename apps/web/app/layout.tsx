import type { Metadata } from "next";
import { AppNav } from "@/components/AppNav";
import "./globals.css";

export const metadata: Metadata = {
  title: "AgentMesh",
  description:
    "Workspace 上下文服务：CLI、MCP 与 HTTP 接入；与编辑器无关，同步、索索引并与协作者共享检索。",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>
        <AppNav />
        {children}
      </body>
    </html>
  );
}
