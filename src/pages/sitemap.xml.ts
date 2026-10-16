import type { APIRoute } from "astro";

import { publicProfiles } from "@/composition/runtime";
import { sitemapXml } from "@/ui/view/sitemap";

export const GET: APIRoute = async ({ url }) =>
  new Response(sitemapXml(url.origin, await publicProfiles().listHandles()), {
    headers: { "Content-Type": "application/xml; charset=utf-8" },
  });
