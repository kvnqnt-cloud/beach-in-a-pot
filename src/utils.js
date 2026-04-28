export function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
export function lerp(a, b, t) { return a + (b - a) * clamp(t, 0, 1); }
export function rand(min, max) { return min + Math.random() * (max - min); }
export function padScore(value) { return String(Math.max(0, Math.floor(value))).padStart(5, "0"); }
export function distanceSquared(ax, ay, bx, by) { const dx = ax - bx; const dy = ay - by; return dx * dx + dy * dy; }
export function smoothstep(edge0, edge1, x) { const t = clamp((x - edge0) / (edge1 - edge0), 0, 1); return t * t * (3 - 2 * t); }
export function drawRoundedPill(g, x, y, w, h, r, fill, alpha = 1, line = 0xffffff, lineAlpha = 0.85) { g.clear(); g.lineStyle(2, line, lineAlpha); g.beginFill(fill, alpha); g.drawRoundedRect(x, y, w, h, r); g.endFill(); }
