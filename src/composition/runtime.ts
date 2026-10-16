// Lo único que lee la configuración del Worker. Páginas y middlewares piden
// sus dependencias acá, ya armadas.
import type { AstroCookies } from "astro";
import { env } from "cloudflare:workers";

import type { AuthGateway } from "@/application/ports/auth-gateway";
import type {
  PublicPageReader,
  PublicProfileDirectory,
} from "@/application/ports/public-page-reader";
import type { RateLimiter } from "@/application/ports/rate-limiter";
import type { SessionReader } from "@/application/ports/session-reader";
import { createAuthGateway } from "@/composition/auth";
import { createPublicPageReader } from "@/composition/public-page";
import { createSessionReader } from "@/composition/session";
import { CloudflareRateLimiter } from "@/infrastructure/cloudflare/cloudflare-rate-limiter";

const supabase = () => ({ url: env.SUPABASE_URL, publishableKey: env.SUPABASE_PUBLISHABLE_KEY });

export const sessionReaderFor = (request: Request, cookies: AstroCookies): SessionReader =>
  createSessionReader(supabase(), request, cookies);

export const authGatewayFor = (request: Request, cookies: AstroCookies): AuthGateway =>
  createAuthGateway(supabase(), request, cookies);

export const authRateLimiter = (): RateLimiter => new CloudflareRateLimiter(env.AUTH_RATE_LIMITER);

export const publicPages = (): PublicPageReader => createPublicPageReader(supabase());

export const publicProfiles = (): PublicProfileDirectory => createPublicPageReader(supabase());

/** Handle que muestra la raíz del dominio (SPEC-public-page, "Raíz del dominio"). */
export const defaultHandle = (): string => env.DEFAULT_HANDLE;
