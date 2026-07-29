const services = [
  {
    title: "Parcel Service",
    description: "Standard shipping from the US, tracked door to door.",
  },
  {
    title: "Cargo",
    description: "Freight forwarding for bulk and heavy shipments.",
  },
  {
    title: "Courier",
    description: "Expedited delivery when timing matters most.",
  },
];

const nav = [
  { label: "Parcel Service", href: "#parcel" },
  { label: "Cargo", href: "#cargo" },
  { label: "Courier", href: "#courier" },
  { label: "Pricing", href: "#pricing" },
  { label: "FAQ", href: "#faq" },
  { label: "Contact", href: "#contact" },
];

export default function Home() {
  return (
    <div className="flex flex-1 flex-col bg-white dark:bg-black">
      <header className="border-b border-black/8 dark:border-white/[.145]">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <span className="text-lg font-semibold tracking-tight">
            Gzavnili
          </span>
          <nav className="hidden gap-6 text-sm font-medium text-zinc-600 dark:text-zinc-400 sm:flex">
            {nav.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="transition-colors hover:text-black dark:hover:text-zinc-50"
              >
                {item.label}
              </a>
            ))}
          </nav>
          <a
            href="/account"
            className="rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc]"
          >
            Log in
          </a>
        </div>
      </header>

      <main className="flex-1">
        <section className="mx-auto max-w-5xl px-6 py-24 text-center sm:text-left">
          <h1 className="max-w-2xl text-4xl font-semibold leading-tight tracking-tight text-black dark:text-zinc-50 sm:text-5xl">
            Faster shipping, lower cost, delivered reliably.
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-zinc-600 dark:text-zinc-400">
            Track a parcel, get a shipping quote, or manage your account —
            all in one place.
          </p>
          <div className="mt-10 flex flex-col gap-4 sm:flex-row">
            <a
              href="#pricing"
              className="flex h-12 items-center justify-center rounded-full bg-foreground px-6 text-base font-medium text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc]"
            >
              Get a quote
            </a>
            <a
              href="/tracking"
              className="flex h-12 items-center justify-center rounded-full border border-solid border-black/8 px-6 text-base font-medium transition-colors hover:border-transparent hover:bg-black/4 dark:border-white/[.145] dark:hover:bg-[#1a1a1a]"
            >
              Track a parcel
            </a>
          </div>
        </section>

        <section className="border-t border-black/8 dark:border-white/[.145]">
          <div className="mx-auto grid max-w-5xl gap-8 px-6 py-16 sm:grid-cols-3">
            {services.map((service) => (
              <div key={service.title} id={service.title.toLowerCase().replace(/\s+/g, "-")}>
                <h2 className="text-xl font-semibold text-black dark:text-zinc-50">
                  {service.title}
                </h2>
                <p className="mt-2 text-base leading-7 text-zinc-600 dark:text-zinc-400">
                  {service.description}
                </p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-black/8 px-6 py-8 text-sm text-zinc-600 dark:border-white/[.145] dark:text-zinc-400">
        <div className="mx-auto max-w-5xl">
          © {new Date().getFullYear()} Gzavnili
        </div>
      </footer>
    </div>
  );
}
