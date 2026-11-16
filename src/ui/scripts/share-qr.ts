// "Código QR" en la ventana de compartir de una página pública. Se arma con
// JavaScript la primera vez que se abre la ventana: la página solo trae la ruta
// del QR (`data-share-qr`), así la primera respuesta no pesa más (el
// presupuesto de LCP de las páginas está justo). Los estilos van por CSSOM, que
// la CSP permite, en vez de sumar reglas a la hoja de la página.

/** El desplegable: "Código QR" y, al abrirlo, la imagen y "Descargar". */
export function buildShareQr(doc: Document, src: string, label: string): HTMLDetailsElement {
  const details = doc.createElement("details");
  details.className = "share-qr";
  Object.assign(details.style, { marginTop: "var(--space-4)", textAlign: "center" });

  const summary = doc.createElement("summary");
  summary.textContent = "Código QR";
  Object.assign(summary.style, {
    display: "inline-flex",
    alignItems: "center",
    minHeight: "var(--target-min)",
    padding: "0 var(--space-4)",
    border: "1px solid var(--color-line)",
    borderRadius: "999px",
    fontSize: "var(--text-sm)",
    cursor: "pointer",
  });

  const image = doc.createElement("img");
  image.alt = `Código QR de ${label}`;
  image.width = 176;
  image.height = 176;
  image.decoding = "async";
  Object.assign(image.style, {
    display: "block",
    margin: "var(--space-3) auto var(--space-2)",
    borderRadius: "var(--radius-sm)",
  });

  const download = doc.createElement("a");
  download.href = `${src}?descargar`;
  download.download = "";
  download.textContent = "Descargar";
  download.style.fontSize = "var(--text-sm)";

  // La imagen se pide recién al abrir el desplegable.
  details.addEventListener("toggle", () => {
    if (details.open && !image.getAttribute("src")) image.src = src;
  });

  details.appendChild(summary);
  details.appendChild(image);
  details.appendChild(download);
  return details;
}

/** Suma el desplegable a la ventana, una sola vez, si la página tiene QR. */
export function mountShareQr(dialog: HTMLElement, label: string): void {
  const src = dialog.dataset["shareQr"];
  if (!src || dialog.querySelector(".share-qr")) return;
  const qr = buildShareQr(dialog.ownerDocument, src, label);
  const status = dialog.querySelector("[data-share-status]");
  dialog.insertBefore(qr, status?.parentNode === dialog ? status : null);
}
