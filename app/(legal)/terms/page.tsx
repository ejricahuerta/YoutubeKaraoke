import type { Metadata } from "next";
import Link from "next/link";
import { OPERATOR } from "@/lib/domain/legal";

export const metadata: Metadata = {
  title: "Terms of Use · YouOke",
  description: "The rules for starting and joining YouOke karaoke sessions.",
};

export default function TermsPage() {
  return (
    <article>
      <h1>Terms of Use</h1>
      <p>
        These terms are an agreement between you and <a href={OPERATOR.url}>{OPERATOR.name}</a> (&ldquo;we&rdquo;,
        &ldquo;us&rdquo;), based in {OPERATOR.location}, who run YouOke. By starting or joining a session you accept them and our{" "}
        <Link href="/privacy">Privacy Policy</Link>. If you do not agree, please don&apos;t use YouOke.
      </p>

      <h2>The service</h2>
      <p>
        YouOke lets one screen play karaoke videos from YouTube while guests add songs from their phones. It is free, needs no
        account, and a session closes for good 15 minutes after the main screen was last open, or after 30 minutes with
        nothing playing or queued. We may change, limit or stop any part of
        YouOke at any time, with or without notice.
      </p>

      <h2>YouTube</h2>
      <p>
        YouOke does not host or own any videos. It finds them through YouTube and plays them in YouTube&apos;s own embedded
        player, using YouTube API Services. By using YouOke you also agree to the{" "}
        <a href="https://www.youtube.com/t/terms">YouTube Terms of Service</a>, and YouTube handles information under the{" "}
        <a href="https://policies.google.com/privacy">Google Privacy Policy</a>.
      </p>
      <ul>
        <li>Videos, songs and lyrics belong to their owners. We do not choose, check or control them.</li>
        <li>A video can stop being available at any time, and some cannot be played outside YouTube.</li>
        <li>YouOke is not made, endorsed or sponsored by YouTube or Google.</li>
      </ul>

      <h2>Hosting a session</h2>
      <p>
        The person who starts a session decides where it is shown and who gets the code. Playing music to an audience can need
        a licence, for example in a bar, venue or at a business event. If you host a session in public, getting any licence
        you need is your responsibility.
      </p>

      <h2>Your behaviour</h2>
      <p>When you use YouOke, don&apos;t:</p>
      <ul>
        <li>use a singer name, or add songs, that are unlawful, hateful, harassing or that pretend to be someone else;</li>
        <li>disrupt other people&apos;s sessions, or join a session you were not invited to in order to cause trouble;</li>
        <li>
          overload, attack, probe or get around the limits and security of YouOke, or use bots, scrapers or other automated
          tools on it;
        </li>
        <li>copy, resell or build a competing service from YouOke, or use it in breach of YouTube&apos;s terms or any law.</li>
      </ul>
      <p>We may remove content, end sessions or block access if we believe these terms are being broken.</p>

      <h2>What you enter</h2>
      <p>
        You are responsible for the singer names you type and the songs you add. They are shown to everyone in the session.
        You let us store and display them only for running the session, until it is deleted as described in the{" "}
        <Link href="/privacy">Privacy Policy</Link>.
      </p>

      <h2>Our name and design</h2>
      <p>
        The YouOke name, logo and design belong to us. Using YouOke does not give you any right to them beyond using the app.
      </p>

      <h2>No warranty</h2>
      <p>
        YouOke is provided <strong>&ldquo;as is&rdquo;</strong> and &ldquo;as available&rdquo;. To the fullest extent the law
        allows, we make no promises that YouOke will be available, uninterrupted, error-free, or suitable for any purpose.
      </p>
      <p>
        Search and playback depend on YouTube, which we do not control. <strong>We do not guarantee that the YouTube player
        will work all the time, or at all.</strong> YouTube can change, limit or block its player or search without notice. A
        video may fail to load, stop partway, play with ads, play at lower quality, or be removed or blocked in your country,
        and search may return no results. We are not responsible for these interruptions or for any event, party or
        performance affected by them.
      </p>

      <h2>Limits on our liability</h2>
      <p>
        To the fullest extent the law allows, we are not liable for indirect or consequential losses, lost data, or anything
        caused by videos, other guests or services we do not control, and our total liability to you is limited to CAD 50 (fifty Canadian dollars).
        Nothing in these terms limits liability that cannot be limited by law, or takes away rights you have as a consumer.
      </p>

      <h2>Changes and ending</h2>
      <p>
        We may update these terms; the date below shows the latest version, and using YouOke after a change means you accept
        it. You can stop using YouOke at any time. Sections that by their nature should last, such as the warranty and
        liability sections, continue after you stop.
      </p>

      <h2>Law</h2>
      <p>
        These terms are governed by the laws of the Province of Ontario and the federal laws of Canada that apply there,
        without regard to conflict-of-law rules. Any dispute will be heard by the courts of Ontario. If you are a consumer,
        you keep the protection of the mandatory laws of the place where you live, including the right to go to your local
        courts where that law gives it. If any part of these terms is unenforceable, the rest still applies.
      </p>

      <h2>Contact</h2>
      <p>Questions about these terms: <a href={`mailto:${OPERATOR.email}`}>{OPERATOR.email}</a>.</p>
    </article>
  );
}
