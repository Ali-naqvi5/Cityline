/**
 * Stands in for Payload's destructive migration commands (DATA-03).
 *
 * `payload.config.ts` registers this script, through Payload's documented
 * `bin` option, under the names `migrate:down`, `migrate:reset`,
 * `migrate:refresh` and `migrate:fresh`. The Payload CLI looks for a `bin`
 * script with the command's name before it runs its own, so this runs instead.
 *
 * Each of those commands empties or rolls back the database it is pointed at:
 * `down()` in the first migration drops all eighteen tables, and `fresh` drops
 * everything outright. DATA-03 requires reset and drop commands to be blocked,
 * and DATA-11 says booking and finance records are never deleted.
 *
 * Production never ships the Payload CLI at all — the server runs only the
 * forward-only `dist/migrate.js` — so this is the guard for every other
 * machine, including the one this is being read on.
 */
export function script(): void {
  const command = process.argv[2] ?? "this command";

  console.error(
    [
      "",
      `Refused: \`payload ${command}\` deletes data, and is blocked in this project (DATA-03).`,
      "",
      "Every database here is changed only by forward migrations. To undo a",
      "migration, write a new one that reverses it. To restore data, use a",
      "database dump (see docs/runbook-vps.md).",
      "",
      "If you really mean to wipe a LOCAL development database, set",
      "ALLOW_DESTRUCTIVE_MIGRATIONS=yes for that one command:",
      "",
      `  bash:        ALLOW_DESTRUCTIVE_MIGRATIONS=yes pnpm payload ${command}`,
      `  PowerShell:  $env:ALLOW_DESTRUCTIVE_MIGRATIONS="yes"; pnpm payload ${command}; Remove-Item Env:ALLOW_DESTRUCTIVE_MIGRATIONS`,
      "",
      "Never on the server.",
      "",
    ].join("\n"),
  );

  // Non-zero, so a script or CI job that tried this fails instead of carrying on.
  process.exit(1);
}
