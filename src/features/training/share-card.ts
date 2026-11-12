'use client';
// Square share image (1080x1080) for Facebook, Messenger, Viber and Telegram. Drawn locally; nothing is uploaded.
export async function makeShareCard(opts: { title: string; subtitle: string; stats: [string | number, string][]; brand: string }) {
  const c = document.createElement('canvas'); c.width = 1080; c.height = 1080; const g = c.getContext('2d')!;
  const grd = g.createLinearGradient(0, 0, 1080, 1080); grd.addColorStop(0, '#1f4d3d'); grd.addColorStop(1, '#2f6b52'); g.fillStyle = grd; g.fillRect(0, 0, 1080, 1080);
  await document.fonts?.load?.('700 64px "Noto Sans Myanmar"').catch(() => {});
  const font = (w: number, s: number) => `${w} ${s}px "Noto Sans Myanmar", Arial, sans-serif`;
  g.fillStyle = '#dcf3a8'; g.font = font(700, 40); g.fillText(opts.brand, 80, 120);
  g.fillStyle = '#ffffff'; g.font = font(700, 72); wrap(g, opts.title, 80, 240, 920, 96);
  g.fillStyle = '#cfe8b8'; g.font = font(400, 40); g.fillText(opts.subtitle, 80, 420);
  opts.stats.slice(0, 4).forEach(([v, l], i) => {
    const x = 80 + (i % 2) * 460, y = 500 + Math.floor(i / 2) * 220;
    g.fillStyle = 'rgba(255,255,255,0.1)'; roundRect(g, x, y, 420, 190, 28); g.fill();
    g.fillStyle = '#ffffff'; g.font = font(700, 84); g.fillText(String(v), x + 34, y + 105);
    g.fillStyle = '#cfe8b8'; g.font = font(400, 34); g.fillText(l, x + 34, y + 160);
  });
  try { const img = await load('/assets/mascot/bee/expressions/bee_celebrating-320.webp'); g.drawImage(img, 760, 40, 280, 280); } catch { /* optional */ }
  return new Promise<Blob>(resolve => c.toBlob(b => resolve(b!), 'image/png'));
}
function load(src: string) { return new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; }); }
function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
function wrap(g: CanvasRenderingContext2D, text: string, x: number, y: number, max: number, lh: number) {
  const words = text.split(' '); let line = '', row = 0;
  for (const w of words) { const t = line ? `${line} ${w}` : w; if (g.measureText(t).width > max && line) { g.fillText(line, x, y + row * lh); line = w; row++; } else line = t; }
  g.fillText(line, x, y + row * lh);
}
export async function shareOrDownload(blob: Blob, fileName: string, text: string) {
  const file = new File([blob], fileName, { type: 'image/png' });
  const nav = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean };
  if (nav.canShare?.({ files: [file] })) { try { await nav.share({ files: [file], text }); return 'shared'; } catch { /* cancelled */ } }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = fileName; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  return 'downloaded';
}
