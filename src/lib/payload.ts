import config from "@payload-config";
import { getPayload, type Payload } from "payload";

/**
 * The Payload local API, for server code that needs the database.
 *
 * This is a direct call into Payload in the same process — not HTTP, not the
 * REST API. Nothing crosses a network boundary, so there is no token to manage
 * and no round trip to pay for.
 *
 * `getPayload` caches its own instance, so this is a thin wrapper that exists
 * mainly to keep `@payload-config` out of every call site. Import it only from
 * server components, server actions and route handlers — pulling it into a
 * client component would try to bundle Payload into the browser.
 */
export function payloadClient(): Promise<Payload> {
  return getPayload({ config });
}
