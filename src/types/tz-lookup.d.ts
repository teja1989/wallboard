/**
 * `tz-lookup` ships no types.
 *
 * Declared here rather than cast at the call site so the shape is stated once, and stated
 * accurately: it throws on coordinates it cannot place, which is why every caller wraps it.
 */
declare module 'tz-lookup' {
  /** The IANA zone containing a coordinate. Throws if the coordinate is not on Earth. */
  export default function tzLookup(latitude: number, longitude: number): string;
}
