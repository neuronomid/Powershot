// Filename → timestamp parsers. Patterns from PRD Appendix A.
// Each parser returns Date | null. First match wins in the caller's cascade.

type Parser = (filename: string) => Date | null;

const toDate = (
  y: number,
  mo: number,
  d: number,
  h: number,
  mi: number,
  s: number,
): Date | null => {
  const date = new Date(y, mo - 1, d, h, mi, s);
  if (Number.isNaN(date.getTime())) return null;
  if (
    date.getFullYear() !== y ||
    date.getMonth() !== mo - 1 ||
    date.getDate() !== d ||
    date.getHours() !== h ||
    date.getMinutes() !== mi ||
    date.getSeconds() !== s
  ) {
    return null;
  }
  return date;
};

// macOS: "Screen Shot 2024-03-15 at 9.41.22 AM.png" or "Screenshot 2024-03-15 at 14.23.01.png"
const macOS: Parser = (name) => {
  const m = name.match(
    /Screen ?[Ss]hot (\d{4})-(\d{2})-(\d{2}) at (\d{1,2})\.(\d{2})\.(\d{2})(\s?([AP])M)?/,
  );
  if (!m) return null;
  const [, y, mo, d, hRaw, mi, s, , ampm] = m;
  let h = Number(hRaw);
  if (ampm === "P" && h < 12) h += 12;
  if (ampm === "A" && h === 12) h = 0;
  return toDate(Number(y), Number(mo), Number(d), h, Number(mi), Number(s));
};

// Android: "Screenshot_20240315_094122.png" or "Screenshot_2024-03-15-09-41-22.png"
const android: Parser = (name) => {
  let m = name.match(/Screenshot_(\d{4})(\d{2})(\d{2})[-_](\d{2})(\d{2})(\d{2})/);
  if (!m) {
    m = name.match(
      /Screenshot_(\d{4})-(\d{2})-(\d{2})-(\d{2})-(\d{2})-(\d{2})/,
    );
  }
  if (!m) return null;
  const [, y, mo, d, h, mi, s] = m;
  return toDate(Number(y), Number(mo), Number(d), Number(h), Number(mi), Number(s));
};

// iOS: "IMG_20240315_094122.png"
const iOS: Parser = (name) => {
  const m = name.match(/IMG_(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})/);
  if (!m) return null;
  const [, y, mo, d, h, mi, s] = m;
  return toDate(Number(y), Number(mo), Number(d), Number(h), Number(mi), Number(s));
};

// Windows: "Screenshot 2024-03-15 094122.png"
const windows: Parser = (name) => {
  const m = name.match(/Screenshot (\d{4})-(\d{2})-(\d{2}) (\d{2})(\d{2})(\d{2})/);
  if (!m) return null;
  const [, y, mo, d, h, mi, s] = m;
  return toDate(Number(y), Number(mo), Number(d), Number(h), Number(mi), Number(s));
};

// Generic: fall-through for ISO-ish stamps anywhere in the filename.
const generic: Parser = (name) => {
  const m = name.match(
    /(\d{4})[-_]?(\d{2})[-_]?(\d{2})[T_ ]?(\d{2})[-:]?(\d{2})[-:]?(\d{2})/,
  );
  if (!m) return null;
  const [, y, mo, d, h, mi, s] = m;
  return toDate(Number(y), Number(mo), Number(d), Number(h), Number(mi), Number(s));
};

const parsers: Parser[] = [macOS, android, iOS, windows, generic];

export function parseFilenameTimestamp(filename: string): Date | null {
  for (const p of parsers) {
    const hit = p(filename);
    if (hit) return hit;
  }
  return null;
}
