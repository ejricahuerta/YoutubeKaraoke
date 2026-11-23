/** Which network a request came from, for the wait after an hour-long session (ADR 0026). */

/** IPv6 groups that name one network: a home or venue gets a /64, its devices pick the rest. */
const IPV6_NETWORK_GROUPS = 4;
const IPV6_GROUPS = 8;

/**
 * The part of an IP address that names a household or venue: the whole IPv4 address, or an
 * IPv6 address's /64 prefix, written the same way however the address was written.
 */
export function networkOf(ip: string): string {
  const address = ip.trim().toLowerCase().replace(/^\[|\]$/g, "").split("%")[0];
  const mapped = address.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (mapped) return mapped[1];
  if (!address.includes(":")) return address;
  const [head, tail] = address.split("::");
  const left = head ? head.split(":") : [];
  const right = tail ? tail.split(":") : [];
  const groups = tail === undefined ? left : [...left, ...Array(Math.max(0, IPV6_GROUPS - left.length - right.length)).fill("0"), ...right];
  return `${groups.slice(0, IPV6_NETWORK_GROUPS).map((g) => (parseInt(g, 16) || 0).toString(16)).join(":")}::/64`;
}
