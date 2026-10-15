/**
 * Lee el formulario de un POST. Si el cuerpo falta o no es un formulario,
 * devuelve uno vacío: una petición mal armada se trata como datos inválidos
 * (y la ruta responde como tal), nunca como un error 500.
 */
export async function readForm(request: Request): Promise<FormData> {
  try {
    return await request.formData();
  } catch {
    return new FormData();
  }
}
