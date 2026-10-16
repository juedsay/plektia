import { describe, expect, it } from "vitest";

import { setDisclosure, toggleDisclosure } from "@/ui/scripts/disclosure";

function parts(expanded: "true" | "false") {
  const attributes = new Map<string, string>([["aria-expanded", expanded]]);
  const classes = new Set<string>();
  const toggle = {
    getAttribute: (name: string) => attributes.get(name) ?? null,
    setAttribute: (name: string, value: string) => void attributes.set(name, value),
  };
  const panel = {
    inert: expanded === "false",
    classList: {
      toggle: (token: string, force: boolean) => {
        if (force) classes.add(token);
        else classes.delete(token);
        return force;
      },
    },
  };
  return { toggle, panel, attributes, classes };
}

describe("disclosure", () => {
  it("abre: aria-expanded, clase y el panel vuelve a ser enfocable", () => {
    const { toggle, panel, attributes, classes } = parts("false");
    toggleDisclosure(toggle, panel);
    expect(attributes.get("aria-expanded")).toBe("true");
    expect(classes.has("is-open")).toBe(true);
    expect(panel.inert).toBe(false);
  });

  it("cierra: el panel sale del orden de foco", () => {
    const { toggle, panel, attributes, classes } = parts("true");
    toggleDisclosure(toggle, panel);
    expect(attributes.get("aria-expanded")).toBe("false");
    expect(classes.has("is-open")).toBe(false);
    expect(panel.inert).toBe(true);
  });

  it("setDisclosure fija el estado pedido sin importar el actual", () => {
    const { toggle, panel, attributes } = parts("true");
    setDisclosure(toggle, panel, true);
    expect(attributes.get("aria-expanded")).toBe("true");
  });
});
