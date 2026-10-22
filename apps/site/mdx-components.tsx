import type { MDXComponents } from "mdx/types";
import type { ReactNode } from "react";
import { CopyBlock } from "@/components/copy-block";
import { Mermaid } from "@/components/mermaid-diagram";
import { ToolReference } from "@/components/tool-reference";
import { Warning } from "@/components/warning";
import type { ReactElement } from "react";

function textOf(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (node && typeof node === "object" && "props" in node) {
    const props = (node as { props?: { children?: ReactNode } }).props;
    return textOf(props?.children);
  }
  return "";
}

function slug(node: ReactNode): string {
  return textOf(node)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    h2: ({ children }) => <h2 id={slug(children)}>{children}</h2>,
    h3: ({ children }) => <h3 id={slug(children)}>{children}</h3>,
    a: ({ href, children }) => {
      const external = typeof href === "string" && href.startsWith("http");
      return (
        <a href={href} {...(external ? { target: "_blank", rel: "noreferrer" } : {})}>
          {children}
        </a>
      );
    },
    table: ({ children }) => (
      <div className="table-wrap">
        <table>{children}</table>
      </div>
    ),
    pre: ({ children }) => {
      const child = (Array.isArray(children) ? children[0] : children) as ReactElement<{ className?: string; children?: ReactNode }> | undefined;
      const className = child?.props?.className ?? "";
      if (className.includes("language-mermaid")) {
        return <Mermaid chart={textOf(child?.props?.children).replace(/\n$/, "")} />;
      }
      return <pre>{children}</pre>;
    },
    CopyBlock,
    Mermaid,
    ToolReference,
    Warning,
    ...components,
  };
}
