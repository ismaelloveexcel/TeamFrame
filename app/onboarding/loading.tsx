export default function OnboardingLoading() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-14">
      <div className="space-y-2 border-b border-ink-300/60 pb-5">
        <div className="h-4 w-24 animate-pulse rounded bg-ink-200" />
        <div className="h-10 w-64 animate-pulse rounded bg-ink-200" />
        <div className="h-4 w-80 animate-pulse rounded bg-ink-100" />
      </div>

      <section className="mt-7 grid gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <article key={i} className="rounded-xl border border-ink-300/70 bg-white/75 p-4">
            <div className="h-3 w-24 animate-pulse rounded bg-ink-100" />
            <div className="mt-3 h-8 w-10 animate-pulse rounded bg-ink-200" />
          </article>
        ))}
      </section>

      <section className="mt-8 rounded-xl border border-ink-300/70 bg-white/80 p-5">
        <div className="h-5 w-40 animate-pulse rounded bg-ink-200" />
        <div className="mt-4 h-10 w-full animate-pulse rounded bg-ink-100" />
      </section>
    </main>
  );
}
