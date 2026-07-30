import type { Handle, RemixNode } from "remix/ui";
import { css } from "remix/ui";
import assets from "../entry.client.ts?assets=client";

export function Document(h: Handle<{ children?: RemixNode; title?: string }>) {
  return () => (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.svg" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,700&family=Source+Sans+3:wght@400;600;700&display=swap"
          rel="stylesheet"
        />
        <title>{h.props.title ?? "Books Store"}</title>
        {assets.css.map((a) => (
          <link key={a.href} rel="stylesheet" href={a.href} />
        ))}
      </head>
      <body mix={css({ margin: 0 })}>
        {h.props.children}
        <script type="module" src={assets.entry} />
      </body>
    </html>
  );
}
