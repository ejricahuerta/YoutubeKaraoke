import { describe, expect, it } from "vitest";
import { networkOf } from "@/lib/domain/network";

describe("networkOf", () => {
  it("keeps a whole IPv4 address: one address is one household or venue", () => {
    expect(networkOf("198.51.100.7")).toBe("198.51.100.7");
    expect(networkOf(" 198.51.100.7 ")).toBe("198.51.100.7");
  });

  it("groups IPv6 addresses by their /64, which a home keeps while its devices change addresses", () => {
    expect(networkOf("2001:db8:1:2:aaaa:bbbb:cccc:dddd")).toBe("2001:db8:1:2::/64");
    expect(networkOf("2001:0DB8:0001:0002::1")).toBe("2001:db8:1:2::/64");
    expect(networkOf("2001:db8::1")).toBe("2001:db8:0:0::/64");
    expect(networkOf("[2001:db8:1:2::9]")).toBe("2001:db8:1:2::/64");
    expect(networkOf("fe80::1%eth0")).toBe("fe80:0:0:0::/64");
  });

  it("reads an IPv4 address written as IPv6 as the IPv4 address", () => {
    expect(networkOf("::ffff:198.51.100.7")).toBe("198.51.100.7");
  });
});
