import type { Metadata } from "next";
import Link from "next/link";
import { OPERATOR } from "@/lib/domain/legal";

export const metadata: Metadata = {
  title: "Privacy Policy · YouOke",
  description: "What YouOke collects, including IP addresses and device information, why, who sees it and how long it is kept.",
};

export default function PrivacyPage() {
  return (
    <article>
      <h1>Privacy Policy</h1>
      <p>
        YouOke is run by <a href={OPERATOR.url}>{OPERATOR.name}</a> (&ldquo;we&rdquo;, &ldquo;us&rdquo;), based in {OPERATOR.location}. This policy says what
        information YouOke handles when you start or join a karaoke session, why, who else sees it and how long it is kept.
        We are the controller of that information.
      </p>

      <h2>The short version</h2>
      <ul>
        <li>There are no accounts. We never ask for your email, phone number or real name.</li>
        <li>
          Like every website, we receive your <strong>IP address and information about your device and browser</strong> with
          each request. We use them to run the app, to tell phones from big screens, and to stop abuse.
        </li>
        <li>The singer name you type and the songs you add are shown to everyone in your session.</li>
        <li>
          The names of songs sung in any session are shown on the start page for a day, without who sang them or in which
          session.
        </li>
        <li>A session&apos;s songs and names are deleted 24 hours after the session closes.</li>
        <li>No ads, no analytics or tracking cookies, and we never sell or share your information for advertising.</li>
      </ul>

      <h2>What we collect</h2>
      <h3>Sent automatically by your browser</h3>
      <ul>
        <li>
          <strong>Your IP address</strong>, which can show roughly where you are (usually your city or network), but not your
          precise location.
        </li>
        <li>
          <strong>Device and browser information</strong>: the user agent (browser, operating system and device type), and
          hints such as whether the device is a phone.
        </li>
        <li>The addresses you visit on YouOke, when, and the referring page.</li>
      </ul>
      <h3>Created by YouOke</h3>
      <ul>
        <li>
          A random <strong>guest id</strong> for your browser and, on the screen that starts a session, a random{" "}
          <strong>host token</strong>. Both are kept in cookies (see the <Link href="/cookies">Cookie Policy</Link>). We store
          only a scrambled (hashed) form of the host token.
        </li>
        <li>
          Session activity: the session code, when songs were added and played, which guest id added each song, which phone
          is the session&apos;s remote, and when the main screen last checked in. If the remote moves the main screen to
          another device, the one-time link it creates is stored only as a hash and expires after 10 minutes.
        </li>
      </ul>
      <h3>What you enter</h3>
      <ul>
        <li>The <strong>singer name</strong> you choose. It can be a nickname; please don&apos;t enter anything sensitive.</li>
        <li>The <strong>songs you add</strong>: the YouTube video id, title, channel, thumbnail and length.</li>
        <li>What you <strong>search for</strong>. We pass the search to YouTube; we do not keep a record of it tied to you.</li>
      </ul>
      <h3>The microphone</h3>
      <p>
        If you turn on the <strong>microphone</strong> on the main screen, your browser asks first. Your voice goes from the
        microphone straight to that device&apos;s speakers, with the echo and reverb added on the device itself. It is never
        recorded, never sent to us or anyone else, and stops when you turn the microphone off or close the page.
      </p>
      <h3>Security reports</h3>
      <p>
        Browsers may send us a report when a page tries to load something our security policy would block. We keep the page
        path and the blocked address, without query strings.
      </p>

      <h2>How we use it</h2>
      <ul>
        <li>
          <strong>To run your session</strong>: the guest id, host token, singer names and songs make the shared queue work
          and decide who may skip, remove or reorder songs. We need these to provide the service you asked for.
        </li>
        <li>
          <strong>To show the right screen</strong>: we read your device information on each request to send phones to the
          add-songs view. We do not store it for this.
        </li>
        <li>
          <strong>To keep YouOke safe and working</strong>: we use your IP address to limit how often a device can search or
          start sessions, and our hosting provider records requests in logs we use to investigate errors and abuse. This is
          in our legitimate interest in running a reliable, secure service.
        </li>
      </ul>
      <p>We do not use your information for advertising, profiling or automated decisions about you, and we do not sell it.</p>

      <h2>Who sees it</h2>
      <ul>
        <li>
          <strong>People in your session.</strong> Your singer name and songs appear on the main screen and on every phone
          that opens the session. Anyone with the session code or QR code can join.
        </li>
        <li>
          <strong>Anyone who opens the start page.</strong> For a day after a song is sung, its name (as YouTube titles the
          video) may float across the start page. Your singer name, your session and when you sang it are never shown there.
        </li>
        <li>
          <strong>Our service providers</strong>, who process it for us to run YouOke:
          <ul>
            <li><strong>Vercel</strong> hosts the app. It handles every request, including your IP address and device information, and keeps request logs.</li>
            <li><strong>Supabase</strong> runs our database and the live updates. Every screen connects to it directly, so it also receives your IP address.</li>
          </ul>
        </li>
        <li>
          <strong>YouTube (Google).</strong> The main screen plays videos in YouTube&apos;s embedded player, in privacy-enhanced
          mode (youtube-nocookie.com), and every screen loads song thumbnails from YouTube. YouTube receives the IP address and
          device information of those screens. It sets no cookies on the main screen until a video plays, but songs start on
          their own, so it sets its own cookies and browser storage there once the first song plays (see the{" "}
          <Link href="/cookies">Cookie Policy</Link>). Searches go from our server to YouTube, not from your device.
          YouTube&apos;s handling is covered by the <a href="https://policies.google.com/privacy">Google Privacy Policy</a>.
        </li>
        <li><strong>Authorities</strong>, if the law requires us to share information, or to protect people or the service.</li>
      </ul>

      <h2>How long we keep it</h2>
      <ul>
        <li>
          <strong>Sessions, singer names and songs</strong>: a session closes when the main screen ends it, an hour after it
          started, 15 minutes after the main screen was last open, or after 30 minutes with nothing playing or queued. It and everything in it are deleted
          24 hours later.
        </li>
        <li><strong>IP addresses for rate limits</strong>: held in server memory for about a minute, never saved to the database.</li>
        <li><strong>Request logs and security reports</strong>: only for the limited time our hosting provider keeps them.</li>
        <li><strong>Cookies and local storage</strong>: for the times listed in the <Link href="/cookies">Cookie Policy</Link>, or until you clear them.</li>
      </ul>

      <h2>Where it is processed</h2>
      <p>
        We are based in Canada, and our providers may process information in the United States and other countries, where
        it may be accessible to courts and authorities under local law. Where the law requires it, transfers are covered by
        safeguards such as the European Commission&apos;s Standard Contractual Clauses.
      </p>

      <h2>Your choices and rights</h2>
      <ul>
        <li>You can remove your own songs from the queue at any time, and the main screen can end the session.</li>
        <li>You can clear YouOke&apos;s cookies and site data in your browser settings.</li>
        <li>
          We follow Canada&apos;s Personal Information Protection and Electronic Documents Act (PIPEDA). Under it, and
          depending on where you live under laws such as Quebec&apos;s Law 25, the GDPR, the UK GDPR or US state privacy
          laws, you may have the right to access, correct, delete or receive a copy of your information, to withdraw consent
          or object to how we use it, and to complain to a data protection authority, such as the{" "}
          <a href="https://www.priv.gc.ca">Office of the Privacy Commissioner of Canada</a>.
        </li>
      </ul>
      <p>
        To make a request, email <a href={`mailto:${OPERATOR.email}`}>{OPERATOR.email}</a>. Because there are no accounts, tell
        us the session code and roughly when you used it so we can find what belongs to you. Often it will already have been
        deleted.
      </p>

      <h2>Children</h2>
      <p>
        YouOke is not meant for children under 13 to use on their own, and we do not knowingly collect information from them.
        If you think a child has given us information, contact us and we will delete it.
      </p>

      <h2>Security</h2>
      <p>
        Connections are encrypted, the database can only be reached through functions that check who is asking, and host
        tokens are stored only as hashes. No system is perfectly secure, but we work to protect what we hold.
      </p>

      <h2>Changes</h2>
      <p>
        If we change how YouOke handles information, we will update this page and the date below. Using YouOke after a
        change means you accept the updated policy.
      </p>

      <h2>Contact</h2>
      <p>Questions or requests: <a href={`mailto:${OPERATOR.email}`}>{OPERATOR.email}</a>.</p>
    </article>
  );
}
