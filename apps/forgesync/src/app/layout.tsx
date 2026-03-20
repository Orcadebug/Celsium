import type { ReactNode } from "react";

export const metadata = {
  title: "ForgeSync",
  description: "AI-native software coordination platform scaffold"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
