// Lo único que lee la configuración del Worker. Páginas y middlewares piden
// sus dependencias acá, ya armadas.
import type { AstroCookies } from "astro";
import { cache, env } from "cloudflare:workers";

import type { AuthGateway } from "@/application/ports/auth-gateway";
import type { PageCache } from "@/application/ports/page-cache";
import type {
  PublicPageReader,
  PublicProfileDirectory,
} from "@/application/ports/public-page-reader";
import type { RateLimiter } from "@/application/ports/rate-limiter";
import type { SessionReader } from "@/application/ports/session-reader";
import { type AdminRepositories, createAdminRepositories } from "@/composition/admin";
import { createAuthGateway } from "@/composition/auth";
import { createContactSender } from "@/composition/contact";
import { createPublicPageReader } from "@/composition/public-page";
import { createSessionReader } from "@/composition/session";
import { WorkerPageCache } from "@/infrastructure/cache/purge";
import { CloudflareRateLimiter } from "@/infrastructure/cloudflare/cloudflare-rate-limiter";
import { createIngestClient } from "@/infrastructure/supabase/ingest-client";

const supabase = () => ({ url: env.SUPABASE_URL, publishableKey: env.SUPABASE_PUBLISHABLE_KEY });

export const sessionReaderFor = (request: Request, cookies: AstroCookies): SessionReader =>
  createSessionReader(supabase(), request, cookies);

export const authGatewayFor = (request: Request, cookies: AstroCookies): AuthGateway =>
  createAuthGateway(supabase(), request, cookies);

/** Repositorios del panel con la sesión del usuario que hace el pedido. */
export const adminRepositoriesFor = (
  request: Request,
  cookies: AstroCookies,
  ownerId: string,
): AdminRepositories => createAdminRepositories(supabase(), request, cookies, ownerId);

export const authRateLimiter = (): RateLimiter => new CloudflareRateLimiter(env.AUTH_RATE_LIMITER);

export const publicPages = (): PublicPageReader => createPublicPageReader(supabase());

export const publicProfiles = (): PublicProfileDirectory => createPublicPageReader(supabase());

export const contactSender = () =>
  createContactSender({
    ingest: createIngestClient(env),
    turnstileSecret: env.TURNSTILE_SECRET_KEY,
    limiter: new CloudflareRateLimiter(env.CONTACT_RATE_LIMITER),
  });

/** Clave pública del widget de Turnstile (va en el HTML). */
export const turnstileSiteKey = (): string => env.TURNSTILE_SITE_KEY;

/** Purga de la caché de páginas. En local `cache` no existe: purgar no hace nada. */
export const pageCache = (): PageCache =>
  new WorkerPageCache(typeof cache === "undefined" ? undefined : (options) => cache.purge(options));
