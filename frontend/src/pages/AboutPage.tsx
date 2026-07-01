export function AboutPage() {
  return (
    <section className="mx-auto max-w-[860px] px-5 py-16 pb-24 md:px-12 bg-white border-x border-b border-burgundy/20 min-h-[calc(100vh-64px)]">
      <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.18em] text-burgundy/50">
        About
      </p>
      <div className="mb-12 flex items-center gap-4">
        <img src="/logo.png" alt="8x8 Logo" className="h-12 w-auto" />
        <h1 className="text-4xl font-black tracking-tight text-ink">
          8x8
        </h1>
      </div>
      {/* What is it */}
      <div className="mb-10 border-l-2 border-burgundy pl-6">
        <h2 className="mb-3 font-mono text-xs uppercase tracking-[0.12em] text-burgundy">
          What is 8x8?
        </h2>
        <p className="text-[15px] leading-7 text-ink/70">
          8x8 is a weekly online chess tournament held every Sunday at 17:00 UTC.
          Players compete in a Gladiator-style elimination format—you enter with
          3 lives and must fight to keep them. The tournament runs for up to 11 rounds,
          and anyone still standing at the end conquers the arena.
        </p>
      </div>
      {/* The format */}
      <div className="mb-10 border-l-2 border-burgundy pl-6">
        <h2 className="mb-3 font-mono text-xs uppercase tracking-[0.12em] text-burgundy">
          The Gladiator Format
        </h2>
        <p className="text-[15px] leading-7 text-ink/70 mb-4">
          Every player starts each tournament with 3 lives (strikes).
        </p>
        <ul className="space-y-2 text-[15px] leading-7 text-ink/70">
          <li>
            <span className="font-semibold text-ink">Win</span> - your opponent
            loses a life. You gain a point.
          </li>
          <li>
            <span className="font-semibold text-ink">Draw</span> - both players
            lose half a life. Both gain 0.5 points.
          </li>
          <li>
            <span className="font-semibold text-ink">Lose</span> - you lose a
            life. Your opponent gains a point.
          </li>
          <li>
            <span className="font-semibold text-ink">No-show</span> - the
            absent player loses a life. The present player gets a walk-over point.
          </li>
        </ul>
        <p className="mt-4 text-[15px] leading-7 text-ink/70">
          Lose all 3 lives and you are eliminated. The players who survive all
          11 rounds are the winners.
        </p>
      </div>
      {/* How it works */}
      <div className="mb-10 border-l-2 border-burgundy pl-6">
        <h2 className="mb-3 font-mono text-xs uppercase tracking-[0.12em] text-burgundy">
          How it Works
        </h2>
        <p className="text-[15px] leading-7 text-ink/70">
          8x8 is built on top of{" "}
          <a
            href="https://lichess.org"
            target="_blank"
            rel="noreferrer"
            className="underline hover:text-burgundy transition-colors"
          >
            Lichess
          </a>
          , the free and open-source chess platform. You sign in with your
          Lichess account, register for the upcoming Sunday tournament, and when
          the event starts your matches are automatically created on Lichess.
          Each round lasts up to 15 minutes — if a match isn't completed in
          time, it is resolved by attendance: who showed up and who didn't.
        </p>
      </div>
      {/* Specs */}
      <div className="border border-burgundy/20 bg-white">
        <div className="border-b border-burgundy/20 px-6 py-3">
          <h2 className="font-mono text-xs uppercase tracking-[0.12em] text-burgundy">
            Tournament Specs
          </h2>
        </div>
        <div className="divide-y divide-burgundy/10">
          {[
            ["Schedule",     "Every Sunday at 17:00 UTC"],
            ["Time control", "5+0 Blitz"],
            ["Format",       "Gladiator - 3 lives"],
            ["Rounds",       "Up to 11"],
            ["Pairing",      "Matched by lives remaining"],
            ["Platform",     "Lichess (free account required)"],
          ].map(([label, value]) => (
            <div key={label} className="flex items-center justify-between px-6 py-3">
              <span className="font-mono text-xs uppercase tracking-[0.08em] text-ink/40">
                {label}
              </span>
              <span className="font-mono text-sm font-semibold text-ink">
                {value}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
