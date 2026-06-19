// Server-only runtime env accessor.
//
// Astro v6 + @astrojs/cloudflare v13 REMOVED `Astro.locals.runtime.env` — it now
// throws at request time ("has been removed in Astro v6"). Worker bindings (vars
// + secrets) are read from the `cloudflare:workers` module instead. The adapter
// itself wires this (`import { env } from 'cloudflare:workers'` in its handler),
// and dev/build/prod all run under workerd so the import resolves in every
// context.
//
// Keep this import ISOLATED here (never re-export it from env.ts) so it can't be
// pulled into a client island bundle — env.ts stays browser-safe.
import { env } from 'cloudflare:workers';

/** The Cloudflare Worker runtime env (vars + secrets) as a plain string map. */
export function workerEnv(): Record<string, string> | undefined {
  return env as unknown as Record<string, string> | undefined;
}
