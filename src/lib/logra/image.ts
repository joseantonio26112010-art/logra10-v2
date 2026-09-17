// Recorta una región normalizada (0-1) de una imagen data URL y devuelve un
// nuevo data URL PNG. Se ejecuta en el cliente para no almacenar la imagen
// original completa en localStorage.
export async function cropImageDataUrl(
  src: string,
  bbox: { x: number; y: number; w: number; h: number },
  pad = 0.02,
): Promise<string> {
  const img = await loadImage(src);
  const x = Math.max(0, (bbox.x - pad)) * img.naturalWidth;
  const y = Math.max(0, (bbox.y - pad)) * img.naturalHeight;
  const w = Math.min(1 - (bbox.x - pad), bbox.w + pad * 2) * img.naturalWidth;
  const h = Math.min(1 - (bbox.y - pad), bbox.h + pad * 2) * img.naturalHeight;
  const canvas = document.createElement("canvas");
  // Limita resolución del recorte para mantener storage razonable.
  const maxSide = 900;
  const scale = Math.min(1, maxSide / Math.max(w, h));
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, x, y, w, h, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.85);
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("No se pudo cargar la imagen"));
    img.src = src;
  });
}
