/**
 * Inviting a friend from a phone (#51): the message, and each messaging app's own share
 * address. The phone's share sheet (navigator.share) covers every app it has; these are
 * for browsers without one, and for people who would rather tap the app they want.
 */

export type InviteLink = { id: "whatsapp" | "sms" | "messenger" | "telegram" | "email"; label: string; href: string };

/** The words sent with the link. It names the room, so the code still works if the link does not. */
export function inviteText(code: string): string {
  return `Come sing karaoke with us! Room ${code}:`;
}

export function inviteLinks(joinUrl: string, code: string): InviteLink[] {
  const text = inviteText(code);
  const url = encodeURIComponent(joinUrl);
  const message = encodeURIComponent(`${text} ${joinUrl}`);
  return [
    { id: "whatsapp", label: "WhatsApp", href: `https://wa.me/?text=${message}` },
    // "?&body=" is the form both iOS and Android read.
    { id: "sms", label: "Messages", href: `sms:?&body=${message}` },
    // Opens the Messenger app; there is no web address for this without a Facebook app id.
    { id: "messenger", label: "Messenger", href: `fb-messenger://share/?link=${url}` },
    { id: "telegram", label: "Telegram", href: `https://t.me/share/url?url=${url}&text=${encodeURIComponent(text)}` },
    {
      id: "email",
      label: "Email",
      href: `mailto:?subject=${encodeURIComponent(`Karaoke: room ${code}`)}&body=${encodeURIComponent(`${text}\n\n${joinUrl}`)}`,
    },
  ];
}
