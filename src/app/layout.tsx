import type { Metadata } from "next";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import "normalize.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Gzavnili",
  description: "Faster, cheaper, reliable parcel, cargo, and courier shipping.",
};

// CSS ported as-is from http/views/layouts/new.html — same files, copied into public/.
// Unlike the legacy layout, no jQuery/main.js/plugin scripts are loaded: every behavior
// they provided (header dropdowns, tracking/login popovers, the home slider, the FAQ
// accordion) is implemented as plain React in src/components/.
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css?family=Montserrat:400,700|Open+Sans:400,400i,600,700"
          rel="stylesheet"
        />
        <link rel="stylesheet" href="/css/style.css?v=1.1" />
        <link rel="stylesheet" href="/css/style_custom.css?v10" />
        <link rel="stylesheet" href="/css/additional.css?v=1" />
      </head>
      <body>
        <Header />
        {children}
        <Footer />
      </body>
    </html>
  );
}
