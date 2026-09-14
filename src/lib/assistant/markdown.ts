// A small, safe Markdown subset for the assistant's answers (D37): paragraphs, headings, lists,
// tables, bold, italics, code and links to the app's own pages. Parsed into a tree that React
// renders, so no HTML from the model ever reaches the page. Pure.

export type Inline =
  | { type: "text"; text: string }
  | { type: "strong" | "em"; children: Inline[] }
  | { type: "code"; text: string }
  | { type: "link"; href: string; children: Inline[] };

export type Block =
  | { type: "paragraph"; children: Inline[] }
  | { type: "heading"; level: 1 | 2 | 3; children: Inline[] }
  | { type: "list"; ordered: boolean; items: Inline[][] }
  | { type: "table"; head: Inline[][]; rows: Inline[][][] };

// **bold**, `code`, [text](href), *italics*: the first that starts earliest wins.
const INLINE = /\*\*(.+?)\*\*|`([^`]+)`|\[([^\]]+)\]\(([^)\s]+)\)|\*([^*\s][^*]*?)\*/g;

/** Only links to the app's own pages ("/decks/…"); anything else stays plain text. */
export function safeHref(href: string): string | null {
  return /^\/(?!\/)[\w\-./?=&%#]*$/.test(href) ? href : null;
}

export function parseInline(text: string): Inline[] {
  const out: Inline[] = [];
  const re = new RegExp(INLINE.source, "g");
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push({ type: "text", text: text.slice(last, m.index) });
    if (m[1] !== undefined) out.push({ type: "strong", children: parseInline(m[1]) });
    else if (m[2] !== undefined) out.push({ type: "code", text: m[2] });
    else if (m[3] !== undefined) {
      const href = safeHref(m[4]);
      out.push(href ? { type: "link", href, children: parseInline(m[3]) } : { type: "text", text: m[3] });
    } else out.push({ type: "em", children: parseInline(m[5]) });
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push({ type: "text", text: text.slice(last) });
  return out;
}

const cells = (row: string) =>
  row
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((c) => parseInline(c.trim()));

/** Blocks of an answer, also while it's still arriving (a half-written line is just text). */
export function parseMarkdown(source: string): Block[] {
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  const blocks: Block[] = [];
  let paragraph: string[] = [];
  const flush = () => {
    if (paragraph.length) blocks.push({ type: "paragraph", children: parseInline(paragraph.join(" ")) });
    paragraph = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || /^(-{3,}|\*{3,})$/.test(line)) {
      flush();
      continue;
    }
    const heading = /^(#{1,6})\s+(.*)$/.exec(line);
    if (heading) {
      flush();
      blocks.push({ type: "heading", level: Math.min(3, heading[1].length) as 1 | 2 | 3, children: parseInline(heading[2]) });
      continue;
    }
    const item = /^([-*+]|\d+[.)])\s+(.*)$/.exec(line);
    if (item) {
      flush();
      const ordered = /\d/.test(item[1]);
      const prev = blocks.at(-1);
      if (prev?.type === "list" && prev.ordered === ordered) prev.items.push(parseInline(item[2]));
      else blocks.push({ type: "list", ordered, items: [parseInline(item[2])] });
      continue;
    }
    // A table: a row of cells, then a |---|---| line.
    if (line.startsWith("|") && /^\|?\s*:?-{2,}/.test(lines[i + 1]?.trim() ?? "")) {
      flush();
      const head = cells(line);
      const rows: Inline[][][] = [];
      for (i += 2; i < lines.length && lines[i].trim().startsWith("|"); i++) rows.push(cells(lines[i]));
      i--;
      blocks.push({ type: "table", head, rows });
      continue;
    }
    paragraph.push(line);
  }
  flush();
  return blocks;
}
