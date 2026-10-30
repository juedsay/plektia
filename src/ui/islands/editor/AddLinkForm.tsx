import { type SubmitEvent, useId, useRef, useState } from "react";

import type { Link, Section } from "@/application/ports/link-repository";
import type { LinkKind } from "@/domain/link-presentation";
import { suggestTitle } from "@/ui/view/editor-state";
import { kindOf } from "@/ui/view/link-kind";
import { profilePrefix, profileUrlFor } from "@/ui/view/profile-url";
import { networkLabel, socialProfileFor } from "@/ui/view/social-profile";

import { type EditorApi, UNREACHABLE } from "./editor-api";
import { KindSelect } from "./KindSelect";
import { PreviewButton } from "./PreviewButton";
import { type LinkSource, NetworkPicker } from "./NetworkPicker";

interface Props {
  readonly api: EditorApi;
  readonly sections: readonly Section[];
  readonly onCreated: (link: Link) => void;
}

/**
 * Agregar un link (SPEC-link-form, 7a): se elige una red y se escribe el
 * usuario, o "Otro link" y se pega la URL. El título se propone (el nombre de la
 * red o el sitio) mientras no se lo escriba a mano. Al servidor siempre llega
 * una URL, que valida como cualquier otra.
 */
export function AddLinkForm({ api, sections, onCreated }: Props) {
  const idPrefix = useId();
  const urlInput = useRef<HTMLInputElement>(null);
  const [source, setSource] = useState<LinkSource>("other");
  const [username, setUsername] = useState("");
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [titleTouched, setTitleTouched] = useState(false);
  const [sectionId, setSectionId] = useState<string>("");
  /** `null`: automático, lo que se deduce de la URL. */
  const [kind, setKind] = useState<LinkKind | null>(null);
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Readonly<Record<string, string>>>({});
  // El id del alta: el mismo en cada reintento de este link, así un pedido
  // repetido no lo duplica (ver requestIdOf). Se renueva al crearlo.
  const requestId = useRef(crypto.randomUUID());
  // Un segundo envío mientras el primero sigue en camino (doble Enter) no sale.
  const inFlight = useRef(false);

  const changeUrl = (value: string) => {
    setUrl(value);
    if (!titleTouched) setTitle(suggestTitle(value));
  };

  const chooseSource = (next: LinkSource) => {
    setSource(next);
    setFieldErrors({});
    setMessage(null);
    if (!titleTouched) setTitle(next === "other" ? suggestTitle(url) : networkLabel(next));
    // El foco va al campo que hay que completar.
    requestAnimationFrame(() => urlInput.current?.focus());
  };

  const profile = source === "other" ? null : profileUrlFor(source, username);
  // En "Otro link", un perfil de una red conocida se ofrece cargar como esa red.
  const pastedProfile = source === "other" ? socialProfileFor(url.trim()) : null;
  // Un artículo puede traer su vista previa y llevar descripción (7c).
  const isArticle = source === "other" && kindOf({ url: url.trim(), kind }) === "article";

  const submit = async (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (inFlight.current) return;
    // Con una red, el usuario se valida acá: sin una URL armada, no hay pedido.
    if (profile && !profile.ok) {
      setFieldErrors({ url: profile.message });
      return;
    }
    const target = profile?.ok ? profile.url : url;
    inFlight.current = true;
    setSaving(true);
    const result = await api
      .create({
        id: requestId.current,
        title,
        url: target,
        sectionId: sectionId === "" ? null : sectionId,
        // Con una red es un perfil: se deduce solo.
        kind: source === "other" ? kind : null,
        ...(isArticle && description.trim() !== "" ? { description } : {}),
      })
      .catch(() => UNREACHABLE);
    inFlight.current = false;
    setSaving(false);
    if (!result.ok) {
      setMessage(result.message);
      setFieldErrors(result.fields);
      return;
    }
    requestId.current = crypto.randomUUID();
    onCreated(result.value);
    // La red elegida queda, para cargar otra del mismo tipo.
    setUrl("");
    setUsername("");
    setKind(null);
    setDescription("");
    setTitle(source === "other" ? "" : networkLabel(source));
    setTitleTouched(false);
    setMessage(null);
    setFieldErrors({});
    urlInput.current?.focus();
  };

  const urlId = `${idPrefix}-url`;
  const titleId = `${idPrefix}-title`;
  const sectionFieldId = `${idPrefix}-section`;

  return (
    <form className="add-link" onSubmit={(event) => void submit(event)} noValidate>
      <h2 className="add-link-title">Agregar un link</h2>
      <NetworkPicker value={source} onChange={chooseSource} />
      {message && (
        <p className="editor-error" role="alert">
          {message}
        </p>
      )}
      <div className="add-link-fields">
        {source === "other" ? (
          <div className="field add-link-url">
            <label htmlFor={urlId}>URL</label>
            <input
              ref={urlInput}
              id={urlId}
              type="url"
              inputMode="url"
              autoComplete="off"
              placeholder="https://"
              value={url}
              onChange={(event) => {
                changeUrl(event.target.value);
              }}
              aria-invalid={fieldErrors["url"] ? true : undefined}
              aria-describedby={fieldErrors["url"] ? `${urlId}-error` : undefined}
            />
            {pastedProfile?.username && (
              <p className="field-hint">
                Es un perfil de {pastedProfile.label}.{" "}
                <button
                  type="button"
                  className="link-button"
                  onClick={() => {
                    setUsername(pastedProfile.username ?? "");
                    chooseSource(pastedProfile.network);
                  }}
                >
                  Cargarlo como {pastedProfile.label}
                </button>
              </p>
            )}
            {fieldErrors["url"] && (
              <p className="field-error" id={`${urlId}-error`}>
                {fieldErrors["url"]}
              </p>
            )}
          </div>
        ) : (
          <div className="field add-link-url">
            <label htmlFor={urlId}>Usuario de {networkLabel(source)}</label>
            <div className="username-input">
              <span className="username-prefix" aria-hidden="true">
                {profilePrefix(source)}
              </span>
              <input
                ref={urlInput}
                id={urlId}
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                value={username}
                onChange={(event) => {
                  setUsername(event.target.value);
                  setFieldErrors({});
                }}
                aria-invalid={fieldErrors["url"] ? true : undefined}
                aria-describedby={`${urlId}-hint${fieldErrors["url"] ? ` ${urlId}-error` : ""}`}
              />
            </div>
            <p className="field-hint" id={`${urlId}-hint`}>
              {profile?.ok
                ? `Se va a abrir ${profile.url.replace(/^https:\/\/(www\.)?/, "")}`
                : "Tu usuario, con o sin @, o el link de tu perfil."}
            </p>
            {fieldErrors["url"] && (
              <p className="field-error" id={`${urlId}-error`}>
                {fieldErrors["url"]}
              </p>
            )}
          </div>
        )}
        <div className="field">
          <label htmlFor={titleId}>Título</label>
          <input
            id={titleId}
            autoComplete="off"
            maxLength={80}
            value={title}
            onChange={(event) => {
              setTitle(event.target.value);
              setTitleTouched(true);
            }}
            aria-invalid={fieldErrors["title"] ? true : undefined}
            aria-describedby={fieldErrors["title"] ? `${titleId}-error` : undefined}
          />
          {fieldErrors["title"] && (
            <p className="field-error" id={`${titleId}-error`}>
              {fieldErrors["title"]}
            </p>
          )}
        </div>
        {source === "other" && (
          <KindSelect id={`${idPrefix}-kind`} url={url} value={kind} onChange={setKind} />
        )}
        {isArticle && (
          <div className="field add-link-url">
            <label htmlFor={`${idPrefix}-description`}>Descripción</label>
            <input
              id={`${idPrefix}-description`}
              autoComplete="off"
              maxLength={120}
              value={description}
              onChange={(event) => {
                setDescription(event.target.value);
              }}
              aria-invalid={fieldErrors["description"] ? true : undefined}
            />
            {fieldErrors["description"] && (
              <p className="field-error">{fieldErrors["description"]}</p>
            )}
            <PreviewButton
              api={api}
              url={url}
              onSuggestion={(suggestion) => {
                if (suggestion.title) {
                  setTitle(suggestion.title);
                  setTitleTouched(true);
                }
                if (suggestion.description) setDescription(suggestion.description);
              }}
            />
          </div>
        )}
        {sections.length > 0 && (
          <div className="field">
            <label htmlFor={sectionFieldId}>Sección</label>
            <select
              id={sectionFieldId}
              value={sectionId}
              onChange={(event) => {
                setSectionId(event.target.value);
              }}
            >
              <option value="">Sin sección</option>
              {sections.map((section) => (
                <option key={section.id} value={section.id}>
                  {section.title}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>
      <button type="submit" className="button" disabled={saving}>
        {saving ? "Agregando…" : "Agregar link"}
      </button>
    </form>
  );
}
