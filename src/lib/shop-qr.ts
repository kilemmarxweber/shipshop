/** PNG du code QR. Le contenu est l’URL publique de la boutique. */
export function shopQrImageUrl(data: string, size = 720) {
  const px = Math.min(1000, Math.max(120, Math.round(size)));
  return `https://api.qrserver.com/v1/create-qr-code/?size=${px}x${px}&margin=28&format=png&data=${encodeURIComponent(data)}`;
}
