import type { Metadata } from 'next';
import { hasLocale, NextIntlClientProvider } from 'next-intl';
import { notFound } from 'next/navigation';
import { Header } from '@/components/Header';
import { Footer } from '@/components/Footer';
import { SitePopup } from '@/components/SitePopup';
import { routing } from '@/i18n/routing';
import 'normalize.css';
import '../globals.css';

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export const metadata: Metadata = {
  title: 'Gzavnili',
  description: 'Faster, cheaper, reliable parcel, cargo, and courier shipping.',
};

// CSS ported as-is from http/views/layouts/new.html — same files, copied into public/.
// Unlike the legacy layout, no jQuery/main.js/plugin scripts are loaded: every behavior
// they provided (header dropdowns, tracking/login popovers, the home slider, the FAQ
// accordion) is implemented as plain React in src/components/.
export default async function LocaleLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  return (
    <html lang={locale}>
      <head>
        <link
          href="https://fonts.googleapis.com/css?family=Montserrat:400,700|Open+Sans:400,400i,600,700&display=swap"
          rel="stylesheet"
        />
        <link rel="stylesheet" href="/css/tooltipster.bundle.min.css" />
        <link rel="stylesheet" href="/css/tooltipster-sideTip-light.min.css" />
        <link rel="stylesheet" href="/css/style.css?v=1.1" />
      </head>
      <body>
        <NextIntlClientProvider>
          <Header />
          {children}
          <Footer />
          <SitePopup locale={locale} />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
