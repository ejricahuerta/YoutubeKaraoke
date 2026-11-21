import { headers } from "next/headers";
import Link from "next/link";
import { Credit } from "@/components/Credit";
import { Logo } from "@/components/Logo";
import { getHostedCodes, getHostHash } from "@/lib/auth";
import { normalizeCode } from "@/lib/codes";
import { isPhone } from "@/lib/device";
import { getState } from "@/lib/sessions";
import { isSupabaseConfigured } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

/** Sessions this browser hosts that are still live (not archived), for "resume". */
async function hostedSessions() {
  const codes = (await getHostedCodes()).map(normalizeCode).filter((c): c is string => c !== null);
  const states = await Promise.all(
    codes.map(async (code) => getState(code, await getHostHash(code), null).catch(() => null)),
  );
  return states.filter((s) => s?.isHost && !s.archived).map((s) => s!);
}

export default async function Home() {
  const configured = isSupabaseConfigured();
  // Phones only join sessions; starting one and the main screen are for big screens.
  const phone = isPhone(await headers());
  const sessions = configured && !phone ? await hostedSessions() : [];

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[70rem] flex-col gap-12 px-6 py-8">
      <header><Logo tile="h-10 w-10 rounded-xl" icon="h-6 w-6" word="text-[1.625rem]" /></header>

      <div className="flex flex-1 flex-wrap items-center gap-x-16 gap-y-12">
        <div className="min-w-0 flex-[999_1_26rem]">
          <h1 className="font-display text-[clamp(3rem,7vw,6rem)] font-extrabold leading-[0.92] tracking-[-0.03em]">
            {phone ? <>Find the code, <span className="text-encore">then sing.</span></> : <>Karaoke night starts on <span className="text-encore">this screen.</span></>}
          </h1>
          <p className="mt-6 max-w-[34rem] text-xl leading-normal text-ink-muted">
            {phone
              ? "Scan the QR code on the karaoke screen, or type its session code here, to add songs."
              : "Open this on the TV or laptop everyone can see. Guests scan a code and add songs from their phones. No app, no accounts."}
          </p>

          {!configured ? (
            <p role="alert" className="mt-8 max-w-[34rem] rounded-row bg-notice-ground p-4 text-sm font-semibold text-notice">
              The database isn&apos;t connected yet. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY, then
              restart the app. See the README.
            </p>
          ) : phone ? null : (
            <form action="/api/sessions" method="post" className="mt-8 flex flex-wrap items-center gap-4">
              <button type="submit" className="h-16 rounded-full bg-encore px-10 text-xl font-bold text-on-encore transition hover:bg-encore-hover active:scale-[0.98]">
                Start a session
              </button>
              <span className="text-[0.9375rem] text-ink-faint">Free. Closes itself 15 minutes after the party ends.</span>
            </form>
          )}
        </div>

        <div className="flex min-w-0 flex-[1_1_22rem] flex-col gap-4">
          {sessions.length > 0 ? (
            <section className="rounded-card bg-stage-100 p-6">
              <h2 className="text-xs font-bold uppercase tracking-[0.1em] text-ink-muted">
                {sessions.length === 1 ? "Your session on this screen" : "Your sessions on this screen"}
              </h2>
              <ul className="mt-3 space-y-2">
                {sessions.map((s) => (
                  <li key={s.code}>
                    <Link href={`/s/${s.code}`} className="flex items-center gap-4 rounded-row bg-stage-200 px-4 py-3 transition hover:bg-stage-300">
                      <span className="font-mono text-xl tracking-[0.14em]">{s.code}</span>
                      <span className="min-w-0 flex-1 truncate text-sm text-ink-muted">
                        {s.current ? s.current.title : "Nothing playing"} · {s.queue.length} queued
                      </span>
                      <span className="text-[0.9375rem] font-bold text-encore">Resume</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section className="rounded-card bg-stage-100 p-6">
            <h2 className="text-xs font-bold uppercase tracking-[0.1em] text-ink-muted">
              {phone ? "Session code" : "Joining a party?"}
            </h2>
            {phone ? null : (
              <p className="mt-3 text-[0.9375rem] leading-relaxed text-ink-muted">Scan the QR code on the karaoke screen, or type its code.</p>
            )}
            <form action="/join" method="get" className="mt-3 flex flex-wrap gap-2">
              <input
                name="code"
                required
                maxLength={6}
                autoCapitalize="characters"
                autoComplete="off"
                placeholder="ABC123"
                aria-label="Session code"
                className="h-[3.25rem] min-w-0 flex-[1_1_10rem] rounded-full border-[1.5px] border-line-strong bg-stage-200 px-5 font-mono text-xl uppercase tracking-[0.14em] text-ink placeholder:text-ink-faint focus:border-spotlight focus:outline-none"
              />
              <button type="submit" className="h-[3.25rem] rounded-full bg-stage-300 px-7 text-base font-semibold transition hover:bg-line active:scale-[0.98]">
                Join
              </button>
            </form>
          </section>
        </div>
      </div>

      <footer className="flex flex-wrap items-center justify-between gap-x-8 gap-y-2 border-t border-line pt-6 text-sm text-ink-faint">
        <span>Plays karaoke and lyrics videos from YouTube.</span>
        <Credit className="text-sm" />
      </footer>
    </main>
  );
}
