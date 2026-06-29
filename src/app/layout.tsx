import type { Metadata } from "next";
import { Doto } from "next/font/google";
import "./globals.css";

const doto = Doto({
  variable: "--font-doto",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "JSON Viewer",
  description: "Parse, inspect, search, and interact with nested JSON.",
};

const RootLayout = ({
  children,
}: Readonly<{
  children: React.ReactNode;
}>): React.ReactNode => {
  return (
    <html lang="en" className={`${doto.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
};

export default RootLayout;
