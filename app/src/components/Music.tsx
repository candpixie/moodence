// Inter has no ♭ or ♯, and the browser's fallback pick is often spaced or
// sized badly. Draw the accidentals in a system font that has real glyphs.
export function Music({ text }: { text: string }) {
  const parts = text.split(/([♭♯])/);
  if (parts.length === 1) return <>{text}</>;
  return <>{parts.map((p, i) => (p === "♭" || p === "♯" ? <span key={i} className="acc">{p}</span> : p))}</>;
}
