import type { Metadata } from "next";
import Link from "next/link";
import { BROWSER_STORAGE, formatLifetime, OPERATOR } from "@/lib/domain/legal";

export const metadata: Metadata = {
  title: "Cookie Policy · YouOke",
  description: "The cookies and browser storage YouOke uses, what each is for and how long it lasts.",
};

export default function CookiesPage() {
  return (
    <article>
      <h1>Cookie Policy</h1>
      <p>
        Cookies and local storage are small pieces of information a website keeps in your browser. YouOke uses a few so that
        a session works: so the app knows which songs are yours, which screen started the session, and your settings.
      </p>

      <h2>What YouOke sets</h2>
      <p>
        All of these are <strong>strictly necessary</strong>: YouOke cannot work without them, so they do not need your
        consent. None of them is used for analytics or advertising, and none is shared with anyone else.
      </p>
      <div className="mt-4 overflow-x-auto rounded-card border border-line">
        <table className="w-full min-w-[34rem] border-collapse text-left text-sm">
          <caption className="sr-only">Cookies and storage YouOke sets</caption>
          <thead className="bg-stage-100 text-xs uppercase tracking-[0.08em] text-ink-faint">
            <tr>
              <th scope="col" className="px-4 py-3">Name</th>
              <th scope="col" className="px-4 py-3">Type</th>
              <th scope="col" className="px-4 py-3">What it is for</th>
              <th scope="col" className="px-4 py-3">Lasts</th>
            </tr>
          </thead>
          <tbody>
            {BROWSER_STORAGE.map((entry) => (
              <tr key={entry.name} className="border-t border-line align-top">
                <td className="whitespace-nowrap px-4 py-3 font-mono text-ink">{entry.name}</td>
                <td className="whitespace-nowrap px-4 py-3">{entry.kind === "cookie" ? "Cookie" : "Local storage"}</td>
                <td className="px-4 py-3">{entry.purpose}</td>
                <td className="px-4 py-3">{formatLifetime(entry)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p>
        <code className="font-mono text-ink">&lt;CODE&gt;</code> is the session&apos;s code, so a screen that has started
        several sessions has one host cookie for each. Both cookies are sent only to YouOke, over a secure connection, and
        cannot be read by page scripts.
      </p>

      <h2>What we don&apos;t use</h2>
      <p>No analytics, advertising, social media or tracking cookies, and no browser fingerprinting.</p>

      <h2>Other companies&apos; cookies</h2>
      <p>
        The main screen plays videos in <strong>YouTube&apos;s embedded player</strong>, in YouTube&apos;s privacy-enhanced mode
        (youtube-nocookie.com). In that mode YouTube sets no cookies on the main screen until a video plays, and Google says
        views there do not affect what you are shown on YouTube.
      </p>
      <p>
        Songs start on their own, so YouTube (Google) does set its own cookies on the main screen once the first song plays.
        Its player also keeps data in the browser&apos;s storage (local storage and IndexedDB) from the moment it loads, and the
        player&apos;s script is fetched from youtube.com. YouTube uses these, for example, to remember player settings, prevent
        abuse and measure use. Every screen also shows song thumbnails from YouTube. We do not control any of this. See{" "}
        <a href="https://policies.google.com/technologies/cookies">how Google uses cookies</a>.
      </p>
      <p>Live updates come from our database provider, Supabase, which sets no cookies.</p>

      <h2>Managing them</h2>
      <p>
        You can see and delete cookies and site data in your browser&apos;s settings, or block them. If you do, the browser
        forgets who it is: a phone can no longer remove songs it added earlier, and a main screen loses control of the
        sessions it started. Blocking YouOke&apos;s cookies stops it from working.
      </p>

      <h2>More</h2>
      <p>
        The <Link href="/privacy">Privacy Policy</Link> covers everything else YouOke handles. Questions:{" "}
        <a href={`mailto:${OPERATOR.email}`}>{OPERATOR.email}</a>.
      </p>
    </article>
  );
}
