export interface RateLimiter {
  /** `true` si el pedido entra en el límite; `false` si hay que rechazarlo. */
  allow(key: string): Promise<boolean>;
}
