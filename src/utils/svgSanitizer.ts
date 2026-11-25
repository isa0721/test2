export interface SvgMetrics {
  viewBox: string;
  width: number;
  height: number;
  elementCount: number;
  byteSize: number;
}

const DANGEROUS_PAIRED_TAGS = [
  "script",
  "foreignObject",
  "iframe",
  "object",
  "embed",
  "audio",
  "video",
];

const DANGEROUS_VOID_TAGS = ["script", "iframe", "embed", "link", "meta", "base"];

/**
 * Extracts the <svg>...</svg> block from raw text and strips potentially unsafe
 * tags, event handlers, and external/script URLs while preserving vector primitives,
 * gradients, clip paths, and internal #id references.
 */
export function sanitizeSvg(rawInput: string, fallbackViewBox = "0 0 512 512"): string {
  if (!rawInput || typeof rawInput !== "string") {
    return "";
  }

  let cleaned = rawInput
    .replace(/```(?:svg|xml|html)?\s*/gi, "")
    .replace(/```/g, "")
    .trim();

  const svgMatch = cleaned.match(/<svg\b[\s\S]*?<\/svg>/i);
  if (!svgMatch) {
    return "";
  }
  cleaned = svgMatch[0];

  // Remove dangerous paired tags (including nested/multiline content)
  for (const tag of DANGEROUS_PAIRED_TAGS) {
    const pairedRegex = new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?<\\/${tag}>`, "gi");
    cleaned = cleaned.replace(pairedRegex, "");
  }

  // Remove dangerous self-closing or unclosed void tags
  for (const tag of DANGEROUS_VOID_TAGS) {
    const voidRegex = new RegExp(`<${tag}\\b[^>]*\\/?>`, "gi");
    cleaned = cleaned.replace(voidRegex, "");
  }

  // Strip inline event handlers (onload, onclick, onerror, etc.)
  cleaned = cleaned.replace(
    /\s+on[a-z0-9_-]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi,
    ""
  );

  // Strip animate/set elements targeting href or event attributes
  cleaned = cleaned.replace(
    /<(?:animate|set)\b[^>]*\battributeName\s*=\s*(?:"(?:xlink:)?href"|'(?:xlink:)?href'|"on[^"]*"|'on[^']*')[^>]*\/?>/gi,
    ""
  );

  // Restrict href / xlink:href / src / action attributes to safe internal #id fragments only
  cleaned = cleaned.replace(
    /\s+((?:xlink:)?href|src|action|formaction)\s*=\s*("([^"]*)"|'([^']*)'|([^\s>]+))/gi,
    (_full, attr: string, _rawVal: string, dqVal?: string, sqVal?: string, bareVal?: string) => {
      const value = (dqVal ?? sqVal ?? bareVal ?? "").trim();
      if (value.startsWith("#")) {
        return ` ${attr}="${value}"`;
      }
      return "";
    }
  );

  // Neutralize unsafe url(...) references (allow only internal url(#id))
  cleaned = cleaned.replace(/url\(\s*(['"]?)(.*?)\1\s*\)/gi, (_full, _q: string, inner: string) => {
    const trimmed = inner.trim();
    if (trimmed.startsWith("#")) {
      return `url(#${trimmed.slice(1).replace(/['"()]/g, "")})`;
    }
    return "none";
  });

  // Neutralize CSS expression() or @import inside style tags/attributes
  cleaned = cleaned.replace(/expression\s*\([^)]*\)/gi, "none");
  cleaned = cleaned.replace(/@import\b[^;]*;?/gi, "");

  // Ensure root <svg> has xmlns and viewBox
  cleaned = cleaned.replace(/<svg\b([^>]*)>/i, (_full, attrs: string) => {
    let nextAttrs = attrs;
    if (!/\bxmlns\s*=/i.test(nextAttrs)) {
      nextAttrs = ` xmlns="http://www.w3.org/2000/svg"${nextAttrs}`;
    }
    if (!/\bviewBox\s*=/i.test(nextAttrs)) {
      nextAttrs = `${nextAttrs} viewBox="${fallbackViewBox}"`;
    }
    return `<svg${nextAttrs}>`;
  });

  return cleaned.trim();
}

export function extractSvgMetrics(svg: string): SvgMetrics {
  const viewBoxMatch = svg.match(/\bviewBox\s*=\s*["']([^"']+)["']/i);
  const viewBox = viewBoxMatch ? viewBoxMatch[1].trim() : "0 0 512 512";
  const parts = viewBox.split(/[\s,]+/).map(Number);

  let width = 512;
  let height = 512;
  if (parts.length === 4 && Number.isFinite(parts[2]) && Number.isFinite(parts[3])) {
    width = Math.round(parts[2]);
    height = Math.round(parts[3]);
  }

  const shapeMatches = svg.match(
    /<(?:path|circle|rect|ellipse|polygon|polyline|line|text|g)\b/gi
  );
  const elementCount = shapeMatches ? shapeMatches.length : 0;
  const byteSize = new TextEncoder().encode(svg).length;

  return {
    viewBox,
    width,
    height,
    elementCount,
    byteSize,
  };
}
