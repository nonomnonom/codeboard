/** Read the family list from a backend-validated shorthand, preserving quoted commas. */
function parseFamilies(font: string) {
  // Escapes need CSS decoding; reject them rather than reporting the wrong dependency.
  if (font.includes("\\")) return null;
  const tokens = font.match(/"[^"\n]*"|'[^'\n]*'|[^\s,/]+|[,/]/g) ?? [];
  const size = tokens.findIndex((token) =>
    /^(?:\d*\.?\d+(?:px|pt|pc|in|cm|mm|%|em|ex|ch|rem|q)|xx-small|x-small|small|medium|large|x-large|xx-large|xxx-large|smaller|larger)$/i.test(
      token,
    ),
  );
  if (size < 0) return null;
  let start = size + 1;
  if (tokens[start] === "/") start += 2;
  const result: { name: string; quoted: boolean }[] = [];
  let words: string[] = [];
  for (const token of [...tokens.slice(start), ","]) {
    if (token !== ",") {
      words.push(token);
      continue;
    }
    if (!words.length) return null;
    const quoted = /^["']/.test(words[0]!);
    if (words.some((word) => /["']/.test(word)) && (!quoted || words.length !== 1)) return null;
    const name = quoted ? words[0]!.slice(1, -1) : words.join(" ");
    if (!name || name.includes("/")) return null;
    result.push({ name, quoted });
    words = [];
  }
  return { prefix: tokens.slice(0, start).join(" "), families: result };
}

export function fontFamilies(font: string): { name: string; quoted: boolean }[] | null {
  return parseFamilies(font)?.families ?? null;
}

export function substituteFontFamilies(font: string, aliases: ReadonlyMap<string, string>): string {
  const parsed = parseFamilies(font);
  if (!parsed?.families.some(({ name }) => aliases.has(name.toLowerCase()))) return font;
  return `${parsed.prefix} ${parsed.families
    .map(({ name, quoted }) => {
      const alias = aliases.get(name.toLowerCase());
      return alias ? JSON.stringify(alias) : quoted ? JSON.stringify(name) : name;
    })
    .join(", ")}`;
}
