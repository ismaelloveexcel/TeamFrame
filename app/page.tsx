import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto min-h-screen max-w-5xl px-6 py-10 md:py-14">
      <header className="flex items-center justify-between border-b border-ink-300/60 pb-5">
        <span className="text-[15px] font-medium tracking-tight">TeamFrame</span>
      </header>

      <section className="mt-12 max-w-2xl space-y-5">
        <p className="text-[12px] tracking-[0.14em] text-ink-500">People operations for small teams</p>
        <h1 className="text-[44px] leading-[1.02] tracking-tight md:text-[62px]">
          A calm directory
          <br />
          for startup teams.
        </h1>
        <p className="max-w-xl text-[17px] leading-relaxed text-ink-700">
          Employees, roles, and org chart in one place. Built for focused teams of 6&ndash;25.
        </p>

        <div className="flex flex-wrap items-center gap-4 pt-2">
          <Link
            href="/auth"
            className="inline-flex items-center justify-center rounded-full bg-ink-900 px-6 py-3 text-[15px] font-medium text-paper transition hover:bg-ink-700"
          >
            Sign in
          </Link>
        </div>
      </section>

      <footer className="mt-16 border-t border-ink-300/60 pt-5 text-[12px] text-ink-500">
        TeamFrame &middot; {new Date().getFullYear()}
      </footer>
    </main>
  );
}
