import { describe, expect, expectTypeOf, it } from "vitest";

import { andThen, err, map, ok, type Result } from "@/domain/result";

describe("Result", () => {
  it("ok envuelve un valor exitoso", () => {
    const result = ok(42);

    expect(result).toEqual({ ok: true, value: 42 });
  });

  it("err envuelve un error esperable", () => {
    const result = err("invalid_input");

    expect(result).toEqual({ ok: false, error: "invalid_input" });
  });

  it("el discriminante `ok` estrecha el tipo", () => {
    // `as` evita que TypeScript estreche la variable a `Ok` al asignarla.
    const result = ok(1) as Result<number, "not_found">;

    if (result.ok) {
      expectTypeOf(result.value).toEqualTypeOf<number>();
    } else {
      expectTypeOf(result.error).toEqualTypeOf<"not_found">();
    }
  });

  describe("map", () => {
    it("transforma el valor de un ok", () => {
      expect(map(ok(2), (n) => n * 10)).toEqual(ok(20));
    });

    it("deja pasar un err sin llamar a la función", () => {
      let called = false;
      const result = map(err("conflict") as Result<number, "conflict">, (n) => {
        called = true;
        return n * 10;
      });

      expect(result).toEqual(err("conflict"));
      expect(called).toBe(false);
    });
  });

  describe("andThen", () => {
    const half = (n: number): Result<number, "odd"> => (n % 2 === 0 ? ok(n / 2) : err("odd"));

    it("encadena un paso que puede fallar", () => {
      expect(andThen(ok(8), half)).toEqual(ok(4));
      expect(andThen(ok(3), half)).toEqual(err("odd"));
    });

    it("corta la cadena ante el primer error", () => {
      const first = err("invalid_input") as Result<number, "invalid_input">;

      expect(andThen(first, half)).toEqual(err("invalid_input"));
    });

    it("une los tipos de error de los dos pasos", () => {
      const first = ok(4) as Result<number, "invalid_input">;
      const result = andThen(first, half);

      expectTypeOf(result).toEqualTypeOf<Result<number, "invalid_input" | "odd">>();
    });
  });
});
