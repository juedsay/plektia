import { useEffect, useId, useRef, useState } from "react";

import {
  type FeaturedMode,
  type LinkMedia,
  type MediaCapabilities,
  parseYouTubeVideoId,
} from "@/domain/link-media";

import { type EditorApi, type Failure, UNREACHABLE } from "./editor-api";

interface Props {
  readonly linkId: string;
  readonly linkTitle: string;
  readonly capabilities: MediaCapabilities;
  readonly api: EditorApi;
  /** Mensaje para la región en vivo ("Guardado"). */
  readonly announce: (message: string) => void;
}

const MODES: readonly { mode: FeaturedMode; name: string; hint: string }[] = [
  { mode: "latest_video", name: "Último video", hint: "Lo más nuevo, sin Shorts ni directos." },
  { mode: "latest_short", name: "Último Short", hint: "Se ve en vertical." },
  { mode: "latest_stream", name: "Último directo", hint: "El último stream que terminó." },
  { mode: "pinned", name: "Fijado", hint: "Un video o Short que elijas, tuyo o de otro canal." },
  { mode: "none", name: "Nada", hint: "El link se muestra solo." },
];

interface Draft {
  watchLive: boolean;
  featuredMode: FeaturedMode;
  /** Lo que pegó el dueño: una URL o el ID. */
  pinnedVideo: string;
}

/**
 * "Transmito en este canal" y el contenido destacado de un link de canal
 * (SPEC-live-status). Cada cambio se guarda solo, con la configuración
 * completa: repetir el pedido deja lo mismo.
 */
export function MediaSettings({ linkId, linkTitle, capabilities, api, announce }: Props) {
  const idPrefix = useId();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [busy, setBusy] = useState(false);

  // Como en LinkRow: los guardados van de a uno y siempre con lo último elegido.
  const saved = useRef<LinkMedia | null>(null);
  const latestDraft = useRef<Draft | null>(null);
  const saving = useRef(false);
  const saveAgain = useRef(false);
  const pendingSave = () => saveAgain.current;

  useEffect(() => {
    let current = true;
    void api
      .getMedia(linkId)
      .catch(() => UNREACHABLE)
      .then((result) => {
        if (!current) return;
        if (!result.ok) {
          setFailure(result);
          return;
        }
        saved.current = result.value.media;
        const loaded = draftOf(result.value.media);
        latestDraft.current = loaded;
        setDraft(loaded);
      });
    return () => {
      current = false;
    };
  }, [api, linkId]);

  const change = (next: Draft) => {
    latestDraft.current = next;
    setDraft(next);
    void save();
  };

  const save = async () => {
    if (saving.current) {
      saveAgain.current = true;
      return;
    }
    saving.current = true;
    setBusy(true);
    try {
      do {
        saveAgain.current = false;
        const next = latestDraft.current;
        const base = saved.current;
        if (!next || !base || !differs(next, base)) break;
        // "Fijado" sin nada pegado todavía: se guarda cuando llegue el video.
        if (next.featuredMode === "pinned" && next.pinnedVideo.trim() === "") break;
        const result = await api
          .setMedia(linkId, {
            watchLive: next.watchLive,
            featuredMode: next.featuredMode,
            pinnedVideo: next.featuredMode === "pinned" ? next.pinnedVideo : null,
          })
          .catch(() => UNREACHABLE);
        if (!result.ok) {
          setFailure(result);
          break;
        }
        saved.current = result.value;
        setFailure(null);
        announce(`${linkTitle}: guardado`);
      } while (pendingSave());
    } finally {
      saving.current = false;
      setBusy(false);
    }
  };

  if (!draft) {
    return (
      <div className="editor-media" aria-busy={!failure || undefined}>
        {failure ? (
          <p className="field-error" role="alert">
            {failure.message}
          </p>
        ) : (
          <p className="field-hint">Cargando las opciones del canal…</p>
        )}
      </div>
    );
  }

  const fieldError = (name: string) => failure?.fields[name];
  const pinnedId = `${idPrefix}-pinned`;
  const generalError = failure && Object.keys(failure.fields).length === 0 ? failure.message : null;

  return (
    <div className="editor-media" aria-busy={busy || undefined}>
      {generalError && (
        <p className="field-error" role="alert">
          {generalError}
        </p>
      )}
      {capabilities.canWatchLive && (
        <div className="choice-group">
          <label className="choice">
            <input
              type="checkbox"
              checked={draft.watchLive}
              onChange={(event) => {
                change({ ...draft, watchLive: event.target.checked });
              }}
              aria-describedby={`${idPrefix}-live-hint`}
            />
            <span className="choice-name">Transmito en este canal</span>
            <span className="choice-hint" id={`${idPrefix}-live-hint`}>
              Cuando estés en vivo, tu página lo muestra.
            </span>
          </label>
          {fieldError("watchLive") && <p className="field-error">{fieldError("watchLive")}</p>}
        </div>
      )}
      {capabilities.canFeature && (
        <fieldset className="choice-group">
          <legend>Contenido destacado</legend>
          {MODES.map(({ mode, name, hint }) => (
            <label key={mode} className="choice">
              <input
                type="radio"
                name={`${idPrefix}-featured`}
                value={mode}
                checked={draft.featuredMode === mode}
                onChange={() => {
                  change({ ...draft, featuredMode: mode });
                }}
                aria-describedby={`${idPrefix}-${mode}-hint`}
              />
              <span className="choice-name">{name}</span>
              <span className="choice-hint" id={`${idPrefix}-${mode}-hint`}>
                {hint}
              </span>
            </label>
          ))}
          {fieldError("featuredMode") && (
            <p className="field-error">{fieldError("featuredMode")}</p>
          )}
          {draft.featuredMode === "pinned" && (
            <div className="field editor-media-pinned">
              <label htmlFor={pinnedId}>Video para fijar</label>
              <input
                id={pinnedId}
                type="url"
                inputMode="url"
                maxLength={2048}
                placeholder="https://youtu.be/…"
                value={draft.pinnedVideo}
                onChange={(event) => {
                  const next = { ...draft, pinnedVideo: event.target.value };
                  latestDraft.current = next;
                  setDraft(next);
                }}
                onBlur={() => void save()}
                aria-invalid={fieldError("pinnedVideo") ? true : undefined}
                aria-describedby={`${pinnedId}-hint${
                  fieldError("pinnedVideo") ? ` ${pinnedId}-error` : ""
                }`}
              />
              <p className="field-hint" id={`${pinnedId}-hint`}>
                Pegá el link de un video o Short de YouTube.
              </p>
              {fieldError("pinnedVideo") && (
                <p className="field-error" id={`${pinnedId}-error`}>
                  {fieldError("pinnedVideo")}
                </p>
              )}
            </div>
          )}
        </fieldset>
      )}
    </div>
  );
}

function draftOf(media: LinkMedia): Draft {
  return {
    watchLive: media.watchLive,
    featuredMode: media.featuredMode,
    pinnedVideo: media.pinnedVideoId ? `https://youtu.be/${media.pinnedVideoId}` : "",
  };
}

/** Si lo elegido es distinto de lo guardado (el video fijado se compara por su ID). */
function differs(draft: Draft, saved: LinkMedia): boolean {
  if (draft.watchLive !== saved.watchLive || draft.featuredMode !== saved.featuredMode) return true;
  return (
    draft.featuredMode === "pinned" &&
    (parseYouTubeVideoId(draft.pinnedVideo) ?? draft.pinnedVideo) !== saved.pinnedVideoId
  );
}
