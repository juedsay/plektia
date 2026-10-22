/** Caché de las páginas públicas: lo que hay que purgar cuando algo cambia. */
export interface PageCache {
  /** Al editar un perfil (panel, MCP) o cambiar su estado en vivo (cron). */
  purgeProfile(handle: string): Promise<void>;
  /** Al cambiar las páginas propias de Plektia. */
  purgeSite(): Promise<void>;
}
