import type { ReactNode } from "react";

export const metadata = {
  title: "ForgeSync",
  description: "Hosted context repos and coordination APIs for AI coding agents",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
