import Link from "next/link";
import { Fragment, type ReactNode } from "react";
import { parseMarkdown, type Block, type Inline } from "@/lib/assistant/markdown";
import { cn } from "@/lib/utils";

function inline(nodes: Inline[]): ReactNode {
  return nodes.map((n, i) => {
    switch (n.type) {
      case "text":
        return <Fragment key={i}>{n.text}</Fragment>;
      case "strong":
        return (
          <strong key={i} className="font-semibold">
            {inline(n.children)}
          </strong>
        );
      case "em":
        return <em key={i}>{inline(n.children)}</em>;
      case "code":
        return (
          <code key={i} className="bg-muted rounded px-1 py-0.5 text-[0.9em]">
            {n.text}
          </code>
        );
      case "link":
        return (
          <Link key={i} href={n.href} className="text-primary underline underline-offset-2">
            {inline(n.children)}
          </Link>
        );
    }
  });
}

function block(b: Block, key: number): ReactNode {
  switch (b.type) {
    case "paragraph":
      return <p key={key}>{inline(b.children)}</p>;
    case "heading":
      return (
        <h3 key={key} className="pt-1 font-semibold">
          {inline(b.children)}
        </h3>
      );
    case "list": {
      const List = b.ordered ? "ol" : "ul";
      return (
        <List key={key} className={cn("space-y-1 pl-5", b.ordered ? "list-decimal" : "list-disc")}>
          {b.items.map((item, i) => (
            <li key={i}>{inline(item)}</li>
          ))}
        </List>
      );
    }
    case "table":
      return (
        <div key={key} className="overflow-x-auto">
          <table className="w-full text-left tabular-nums">
            <thead>
              <tr className="border-b">
                {b.head.map((cell, i) => (
                  <th key={i} className="px-2 py-1 font-medium">
                    {inline(cell)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {b.rows.map((row, i) => (
                <tr key={i} className="border-b last:border-0">
                  {row.map((cell, j) => (
                    <td key={j} className="px-2 py-1 align-top">
                      {inline(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
  }
}

/** An assistant's answer: its Markdown, rendered safely (markdown.ts). */
export function Answer({ text }: { text: string }) {
  return <div className="space-y-3 text-sm leading-relaxed">{parseMarkdown(text).map(block)}</div>;
}
