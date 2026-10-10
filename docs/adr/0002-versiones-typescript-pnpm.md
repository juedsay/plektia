# ADR 0002: TypeScript 6 y pnpm 11 en lugar de las majors más nuevas

- **Estado:** aceptada
- **Fecha:** 2026-10-10

## Contexto

La regla del proyecto es usar la última versión estable de cada herramienta ([SPEC-platform](../../SPEC-platform.md)). Al armar el proyecto (tarea 1), las últimas eran TypeScript 7.0.2 y pnpm 12.10.1.

## Decisión

- **TypeScript 6.0.3**, la última de la rama 6.
- **pnpm 11.28.5**, la última de la rama 11, fijada en `packageManager` vía Corepack.

## Motivos

- **TypeScript 7:** `@astrojs/check` 0.9.10, que hace el chequeo de tipos de los archivos `.astro`, declara compatibilidad solo con TypeScript `^5 || ^6`. TypeScript 7 (el compilador nativo) todavía no expone la API que esas herramientas necesitan.
- **pnpm 12:** se distribuye como binario nativo de Windows, y la directiva de Control de aplicaciones del equipo de desarrollo (Smart App Control / Device Guard) lo bloquea. Desactivarla bajaría la protección de todo el equipo, y la rama 11 es JavaScript, sigue mantenida y es compatible con el resto del stack.

## Consecuencias

- Renovate propone subir a TypeScript 7 cuando `@astrojs/check` lo soporte, y a pnpm 12 cuando haya un binario firmado o una alternativa que pase la directiva. Cada subida va en su propio PR con la CI en verde.
- La CI usa las mismas versiones que el entorno local, así que el lockfile es el mismo en los dos lados.
