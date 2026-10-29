import {
  siBluesky,
  siFacebook,
  siGithub,
  siInstagram,
  siKick,
  siThreads,
  siTiktok,
  siTwitch,
  siX,
  siYoutube,
} from "simple-icons";

import type { SocialNetwork } from "@/ui/view/social-profile";

// Logos de las redes (simple-icons, CC0), en un solo lugar para la página
// pública y el editor. LinkedIn no está en simple-icons (lo retiraron a pedido
// de la marca): quien lo dibuja usa un "in" genérico.
export const NETWORK_ICON_PATHS: Partial<Record<SocialNetwork, string>> = {
  instagram: siInstagram.path,
  twitch: siTwitch.path,
  github: siGithub.path,
  youtube: siYoutube.path,
  x: siX.path,
  tiktok: siTiktok.path,
  kick: siKick.path,
  facebook: siFacebook.path,
  threads: siThreads.path,
  bluesky: siBluesky.path,
};
