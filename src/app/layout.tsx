import type { Metadata } from "next";
import Script from "next/script";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import "./globals.css";

export const metadata: Metadata = {
  title: "Gzavnili",
  description: "Faster, cheaper, reliable parcel, cargo, and courier shipping.",
};

// Legacy CSS/JS ported as-is from http/views/layouts/new.html — same files,
// copied into public/, loaded the same way the CFML layout loaded them.
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
        <link rel="stylesheet" href="/bower_components/featherlight/release/featherlight.min.css" />
        <link rel="stylesheet" href="/bower_components/lightslider/dist/css/lightslider.min.css" />
        <link rel="stylesheet" href="/bower_components/normalize-css/normalize.css" />
        <link
          rel="stylesheet"
          href="/bower_components/datetimepicker/build/jquery.datetimepicker.min.css"
        />
        <link rel="stylesheet" href="/bower_components/select2/dist/css/select2.min.css" />
        <link rel="stylesheet" href="/css/tooltipster.bundle.min.css" />
        <link rel="stylesheet" href="/css/tooltipster-sideTip-light.min.css" />
        <link rel="stylesheet" href="/css/style.css?v=1.1" />
        <link rel="stylesheet" href="/css/style_custom.css?v10" />
        <link rel="stylesheet" href="/css/additional.css?v=1" />
      </head>
      <body>
        <Header />
        {children}
        <Footer />

        <Script src="/bower_components/jquery/dist/jquery.js" strategy="beforeInteractive" />
        <Script src="/js/tooltipster.bundle.min.js" strategy="afterInteractive" />
        <Script src="/js/jquery.parallax.min.js" strategy="afterInteractive" />
        <Script src="/js/jquery.parallax-bg.js" strategy="afterInteractive" />
        <Script src="/js/additional.js" strategy="afterInteractive" />
        <Script src="/bower_components/iCheck/icheck.min.js" strategy="afterInteractive" />
        <Script src="/bower_components/featherlight/release/featherlight.min.js" strategy="afterInteractive" />
        <Script src="/bower_components/select2/dist/js/select2.js" strategy="afterInteractive" />
        <Script src="/bower_components/lightslider/dist/js/lightslider.min.js" strategy="afterInteractive" />
        <Script
          src="/bower_components/datetimepicker/build/jquery.datetimepicker.full.min.js"
          strategy="afterInteractive"
        />
        <Script src="/js/main.js?v17" strategy="afterInteractive" />
      </body>
    </html>
  );
}
