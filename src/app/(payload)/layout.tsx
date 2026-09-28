/**
 * Payload's own layout for /admin (§10, ADM-*).
 *
 * This route group is deliberately separate from `(site)`: the admin brings
 * its own HTML shell, styles and fonts, and must not inherit the public
 * site's header, footer or theme. Nothing here is reachable by the public —
 * `src/proxy.ts` sends `X-Robots-Tag: noindex` and `robots.ts` disallows it.
 */
import type { ServerFunctionClient } from "payload";
import config from "@payload-config";
import { RootLayout, handleServerFunctions } from "@payloadcms/next/layouts";
import { importMap } from "./admin/importMap";
import "@payloadcms/next/css";

type Args = { children: React.ReactNode };

const serverFunction: ServerFunctionClient = async function (args) {
  "use server";
  return handleServerFunctions({ ...args, config, importMap });
};

export default function Layout({ children }: Args) {
  return (
    <RootLayout config={config} importMap={importMap} serverFunction={serverFunction}>
      {children}
    </RootLayout>
  );
}
