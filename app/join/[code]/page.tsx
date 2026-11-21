import type { Metadata } from "next";
import { GuestScreen } from "@/components/GuestScreen";
import { CenteredMessage } from "@/components/HostScreen";
import { normalizeCode } from "@/lib/codes";

export const metadata: Metadata = { title: "Add a song · Karaoke" };

export default async function JoinPage({ params }: { params: Promise<{ code: string }> }) {
  const code = normalizeCode(decodeURIComponent((await params).code));
  if (!code) {
    return (
      <CenteredMessage title="That code doesn't look right">
        Session codes are 6 letters and numbers. Scan the QR code on the karaoke screen to join.
      </CenteredMessage>
    );
  }
  return <GuestScreen code={code} />;
}
