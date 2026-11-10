import type { Element, ElementContent, Root, RootContent } from "hast";
import { createContext, useContext, type ComponentProps, type MouseEvent } from "react";
import Markdown, { type Components, type ExtraProps } from "react-markdown";
import remarkGfm from "remark-gfm";
import { ArrowUpRight } from "lucide-react";
import { sourceFromEvidence, sourceLabel, type CoachSource } from "../services/coachSources";
import type { CoachResult } from "../types";

type OpenSource = (source: CoachSource, event: MouseEvent<HTMLButtonElement>) => void;
type Evidence = NonNullable<CoachResult["evidence"]>[number];
const SourceContext = createContext<{ sources: Map<string | undefined, Evidence>; live: boolean; onOpen: OpenSource } | null>(null);
const reference = "[a-z][a-z0-9_]*:[a-z0-9][a-z0-9_.-]*";
const citationGroup = new RegExp(`\\[(${reference}(?:\\s*;\\s*${reference})*)\\]`, "gi");

function citationNode(id: string): Element {
  return { type: "element", tagName: "span", properties: { dataCoachCitation: id }, children: [] };
}

function coachCitations(live: boolean, evidence: CoachResult["evidence"]) {
  return function transform(tree: Root) {
    const cited = new Set<string>();
    function replace(children: RootContent[]): RootContent[] {
      return children.flatMap((child): RootContent[] => {
        if (child.type === "element") {
          if (!["a", "code", "pre"].includes(child.tagName)) {
            child.children = replace(child.children) as ElementContent[];
          }
          return [child];
        }
        if (child.type !== "text") return [child];
        const nodes: RootContent[] = [];
        const text = live ? child.value.replace(/\*\*|__|\x60+/g, "") : child.value;
        let start = 0;
        for (const match of text.matchAll(citationGroup)) {
          const end = match.index ?? 0;
          if (end > start) nodes.push({ type: "text", value: text.slice(start, end) });
          for (const id of (match[1] || "").split(/\s*;\s*/)) {
            cited.add(id);
            nodes.push(citationNode(id));
          }
          start = end + match[0].length;
        }
        if (start < text.length) nodes.push({ type: "text", value: text.slice(start) });
        return nodes;
      });
    }
    tree.children = replace(tree.children);
    if (live) return;
    const additional = new Set(evidence?.flatMap(item => item.id && !cited.has(item.id) && sourceFromEvidence(item) ? [item.id] : []));
    if (additional.size) {
      tree.children.push({
        type: "element",
        tagName: "details",
        properties: { className: ["coach-markdown-sources"] },
        children: [
          { type: "element", tagName: "summary", properties: {}, children: [{ type: "text", value: "Sources" }] },
          { type: "element", tagName: "div", properties: { className: ["coach-evidence"] }, children: [...additional].map(citationNode) },
        ],
      });
    }
  };
}

function visibleDraft(text: string) {
  // Render complete words and hold an open citation until its closing bracket.
  return text.replace(/\S+$/u, "").replace(/\[[a-z0-9_:\s;.-]*$/i, "");
}

function CitationSpan({ node, children }: ComponentProps<"span"> & ExtraProps) {
  const context = useContext(SourceContext);
  const id = node?.properties.dataCoachCitation;
  if (typeof id !== "string" || !context) return <span>{children}</span>;
  const { sources, live, onOpen } = context;
  const evidence = sources.get(id);
  const label = sourceLabel(id);
  const source = evidence && sourceFromEvidence(evidence);
  const caption = <>{label}{source?.date && source.kind !== "workout" ? ` · ${source.date}` : ""}</>;
  if (source && !live) {
    return <button type="button" className="coach-citation" onClick={event => onOpen(source, event)}>
      {caption}<ArrowUpRight size={12} aria-hidden="true" />
    </button>;
  }
  return <span className="coach-citation coach-citation-muted">{caption}{live ? "" : " · Source unavailable"}</span>;
}

const markdownComponents: Components = {
  span: CitationSpan,
  a: ({ href, children }) => href ? <a href={href} target="_blank" rel="noreferrer">{children}</a> : <>{children}</>,
  table: ({ children }) => <div className="coach-markdown-table"><table>{children}</table></div>,
};

export function CoachMarkdown({ content, evidence, live = false, onOpen }: {
  content: string;
  evidence?: CoachResult["evidence"];
  live?: boolean;
  onOpen: OpenSource;
}) {
  const sources = new Map(evidence?.map(item => [item.id, item]));
  return <SourceContext.Provider value={{ sources, live, onOpen }}>
    <div className={`coach-markdown${live ? " coach-markdown-live" : ""}`}>
      <Markdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[() => coachCitations(live, evidence)]}
        skipHtml
        disallowedElements={["img"]}
        urlTransform={url => /^https?:\/\//i.test(url) ? url : ""}
        components={markdownComponents}
      >{live ? visibleDraft(content) : content}</Markdown>
    </div>
  </SourceContext.Provider>;
}
