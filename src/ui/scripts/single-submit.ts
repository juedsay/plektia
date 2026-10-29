// Un formulario que se envía una sola vez: un doble clic dispararía un segundo
// pedido (en el consentimiento, el segundo ya no es válido y taparía el
// resultado del primero). La marca se pone en el mismo evento: el segundo
// `submit` llega antes de que los botones se deshabiliten.
export function guardSingleSubmit(form: HTMLFormElement): void {
  let sent = false;
  form.addEventListener("submit", (event) => {
    if (sent) {
      event.preventDefault();
      return;
    }
    sent = true;
    // En el próximo frame: deshabilitarlos antes cancelaría el envío en curso
    // (y se perdería el valor del botón que se tocó).
    requestAnimationFrame(() => {
      for (const button of form.querySelectorAll("button")) {
        button.disabled = true;
      }
      form.setAttribute("aria-busy", "true");
    });
  });
}
