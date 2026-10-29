// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";

import { type BeaconTransport, mountBeacon, send } from "@/ui/scripts/beacon";

const LINK = "0b1d2c3e-4f5a-4b6c-8d7e-9f0a1b2c3d4e";

function recordingTransport(beaconWorks = true) {
  const beacons: { url: string; body: unknown }[] = [];
  const fetches: { url: string; init: RequestInit }[] = [];
  const transport: BeaconTransport = {
    sendBeacon: (url, body) => {
      beacons.push({ url, body: JSON.parse(body) as unknown });
      return beaconWorks;
    },
    fetch: (url, init) => {
      fetches.push({ url, init });
      return Promise.resolve();
    },
  };
  return { transport, beacons, fetches };
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("beacon", () => {
  it("cuenta la visita al montar y cada clic en un link, solo con t, h/l y s", () => {
    document.body.innerHTML = `
      <div data-stats-handle="juedsay">
        <a href="https://example.com" data-link-id="${LINK}"><span>Link</span></a>
        <button type="button">Otra cosa</button>
      </div>`;
    const root = document.querySelector<HTMLElement>("[data-stats-handle]");
    const { transport, beacons } = recordingTransport();
    if (root) mountBeacon(root, transport);

    document.querySelector("span")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    document.querySelector("button")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(beacons).toEqual([
      { url: "/api/e", body: { t: "view", h: "juedsay", s: "direct" } },
      { url: "/api/e", body: { t: "click", l: LINK, s: "direct" } },
    ]);
  });

  it("sin handle (vista previa del panel) no manda nada", () => {
    document.body.innerHTML = `<div data-patchbay></div>`;
    const { transport, beacons } = recordingTransport();
    const root = document.querySelector<HTMLElement>("[data-patchbay]");
    if (root) mountBeacon(root, transport);
    expect(beacons).toEqual([]);
  });

  it("si sendBeacon no acepta el aviso, usa fetch con keepalive", () => {
    const { transport, fetches } = recordingTransport(false);
    send({ t: "view", h: "juedsay", s: "direct" }, transport);
    expect(fetches).toHaveLength(1);
    expect(fetches[0]?.init).toMatchObject({ method: "POST", keepalive: true });
  });
});
