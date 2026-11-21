import { headers } from "next/headers";
import Link from "next/link";
import { MicIcon } from "@/components/icons";
import { getHostedCodes, getHostHash } from "@/lib/auth";
import { normalizeCode } from "@/lib/codes";
import { isPhone } from "@/lib/device";
import { getState } from "@/lib/sessions";
import { isSupabaseConfigured } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

/** Sessions this browser hosts that are still alive, for "resume". */
async function hostedSessions() {
  const codes = (await getHostedCodes()).map(normalizeCode).filter((c): c is string => c !== null);
  const states = await Promise.all(
    codes.map(async (code) => getState(code, await getHostHash(code), null).catch(() => null)),
  );
  return states.filter((s) => s?.isHost).map((s) => s!);
}

export default async function Home() {
  const configured = isSupabaseConfigured();
  // Phones only join sessions; starting one and the main screen are for big screens.
  const phone = isPhone(await headers());
  const sessions = configured && !phone ? await hostedSessions() : [];

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col justify-center px-6 py-12">
      <span className="grid h-14 w-14 place-items-center rounded-full bg-rose-600"><MicIcon className="h-7 w-7" /></span>
      <h1 className="mt-6 text-4xl font-bold tracking-tight">Karaoke night</h1>
      <p className="mt-3 text-lg text-neutral-400">
        {phone
          ? "Scan the QR code on the karaoke screen, or type its session code here, to add songs."
          : "Open this on the big screen and start a session. Everyone scans the QR code and adds songs from their phone."}
      </p>

      {!configured ? (
        <p role="alert" className="mt-8 rounded-xl bg-amber-500/15 p-4 text-sm text-amber-200">
          The database isn&apos;t connected yet. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY, then
          restart the app. See the README.
        </p>
      ) : phone ? null : (
        <form action="/api/sessions" method="post" className="mt-8">
          <button type="submit" className="h-14 w-full rounded-full bg-rose-600 text-lg font-semibold text-white transition hover:bg-rose-500">
            Start a session
          </button>
        </form>
      )}

      {sessions.length > 0 ? (
        <section className="mt-10">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-400">Your sessions on this screen</h2>
          <ul className="mt-3 space-y-2">
            {sessions.map((s) => (
              <li key={s.code}>
                <Link href={`/s/${s.code}`} className="flex items-center justify-between gap-4 rounded-xl bg-white/5 px-4 py-3 transition hover:bg-white/10">
                  <span className="font-mono text-lg font-semibold tracking-widest">{s.code}</span>
                  <span className="min-w-0 flex-1 truncate text-sm text-neutral-400">
                    {s.current ? s.current.title : "Nothing playing"} · {s.queue.length} queued
                  </span>
                  <span className="text-sm font-medium text-rose-400">Resume</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className={phone ? "mt-8" : "mt-10 border-t border-white/10 pt-8"}>
        <h2 className="text-sm font-semibold uppercase tracking-wider text-neutral-400">
          {phone ? "Session code" : "On your phone?"}
        </h2>
        <form action="/join" method="get" className="mt-3 flex gap-2">
          <input
            name="code"
            required
            maxLength={6}
            autoCapitalize="characters"
            autoComplete="off"
            placeholder="Session code"
            aria-label="Session code"
            className="h-12 min-w-0 flex-1 rounded-full border border-white/10 bg-neutral-900 px-5 font-mono text-base uppercase tracking-widest text-white placeholder:font-sans placeholder:normal-case placeholder:tracking-normal placeholder:text-neutral-500 focus:border-rose-500 focus:outline-none"
          />
          <button type="submit" className="h-12 rounded-full bg-white/10 px-6 text-sm font-semibold text-white transition hover:bg-white/15">
            Join
          </button>
        </form>
      </section>
    </main>
  );
}
