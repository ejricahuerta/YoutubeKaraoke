import { describe, expect, it } from "vitest";
import { inviteLinks, inviteText } from "@/lib/domain/invite";

const URL = "https://karaoke.edmel.dev/join/ABC234";

describe("inviteText", () => {
  it("names the room, so the code works even where the link does not", () => {
    expect(inviteText("ABC234")).toBe("Come sing karaoke with us! Room ABC234:");
  });
});

describe("inviteLinks", () => {
  const links = Object.fromEntries(inviteLinks(URL, "ABC234").map((link) => [link.id, link]));
  const message = encodeURIComponent(`Come sing karaoke with us! Room ABC234: ${URL}`);

  it("offers every common way to send a link from a phone, in a fixed order", () => {
    expect(inviteLinks(URL, "ABC234").map((link) => link.label)).toEqual(["WhatsApp", "Messages", "Messenger", "Telegram", "Email"]);
  });

  it("puts the message and link in each app's share address", () => {
    expect(links.whatsapp.href).toBe(`https://wa.me/?text=${message}`);
    // "?&body=" is read by both iOS and Android.
    expect(links.sms.href).toBe(`sms:?&body=${message}`);
    expect(links.messenger.href).toBe(`fb-messenger://share/?link=${encodeURIComponent(URL)}`);
    expect(links.telegram.href).toBe(
      `https://t.me/share/url?url=${encodeURIComponent(URL)}&text=${encodeURIComponent("Come sing karaoke with us! Room ABC234:")}`,
    );
    expect(links.email.href).toBe(
      `mailto:?subject=${encodeURIComponent("Karaoke: room ABC234")}&body=${encodeURIComponent(`Come sing karaoke with us! Room ABC234:\n\n${URL}`)}`,
    );
  });

  it("escapes anything in the link that would break an address", () => {
    const odd = inviteLinks("https://example.com/join/A&B?x=1#y", "ABC234");
    expect(odd.every((link) => !link.href.includes("#y") && !link.href.includes("A&B"))).toBe(true);
  });
});
