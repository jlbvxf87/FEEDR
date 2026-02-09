import type { Metadata } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import "./globals.css";

// Force Node.js runtime to avoid Edge Runtime __dirname issues
export const runtime = "nodejs";

const inter = Inter({ 
  subsets: ["latin"],
  variable: "--font-inter",
});
const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display",
});

export const metadata: Metadata = {
  title: "FEEDR",
  description: "Generate. Scroll. Pick winners.",
  icons: {
    icon: "/logo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`dark ${inter.variable} ${spaceGrotesk.variable}`}>
      <body className={`${inter.variable} font-sans antialiased min-h-screen bg-[#0B0E11]`}>
        {children}
      </body>
    </html>
  );
}
