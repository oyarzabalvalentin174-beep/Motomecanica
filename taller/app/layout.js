import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import AuthSessionProvider from "@/components/AuthSessionProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "Motomecánica Oyarzabal",
  description: "Sistema de gestion de Motomecánica Oyarzabal",
  icons: {
    icon: [
      { url: "/logo.jpg", type: "image/jpeg" },
      { url: "/logo.jpg", type: "image/jpeg", sizes: "32x32" },
      { url: "/logo.jpg", type: "image/jpeg", sizes: "16x16" },
    ],
    apple: [{ url: "/logo.jpg", type: "image/jpeg" }],
    shortcut: "/logo.jpg",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <AuthSessionProvider>{children}</AuthSessionProvider>
      </body>
    </html>
  );
}
