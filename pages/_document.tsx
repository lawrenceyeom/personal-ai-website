import { Html, Head, Main, NextScript } from 'next/document'

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/npm/katex@0.16.4/dist/katex.min.css"
          integrity="sha384-nB0miv6/jRmo5UMMR1wu3Gz6NLsoTkbqJghGIsx//Rlm+ZU03BU6SQNC66uf4l5+"
          crossOrigin="anonymous"
        />
        <style jsx global>{`
          /* Global Styles */
          body {
            min-height: 100vh;
            background: linear-gradient(to bottom right, #0f172a, #1e293b, #2563eb);
            background-attachment: fixed;
            font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif;
            color: #f3f4f6;
            font-size: 1.125rem;
            line-height: 1.75rem;
            margin: 0;
            padding: 0;
          }

          .card {
            background-color: rgba(30, 35, 51, 0.8);
            border-radius: 1rem;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
            backdrop-filter: blur(16px);
            border: 1px solid #233056;
          }

          .card-gradient {
            background: linear-gradient(135deg, #2563eb 0%, #0f172a 100%);
            color: white;
            border-radius: 1.25rem;
            box-shadow: 0 4px 32px 0 rgba(37,99,235,0.12);
          }

          .btn-main {
            background: linear-gradient(to right, #2563eb, #1e293b);
            color: white;
            font-weight: 600;
            border-radius: 0.75rem;
            box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06);
            transition: all 0.15s ease-in-out;
          }

          .btn-main:hover {
            filter: brightness(1.25);
          }

          /* Highlight.js GitHub Dark Theme */
          pre code.hljs {
            display: block;
            overflow-x: auto;
            padding: 1em;
          }
          code.hljs {
            padding: 3px 5px;
          }
          .hljs {
            color: #c9d1d9;
            background: #0d1117;
          }
          .hljs-doctag,
          .hljs-keyword,
          .hljs-meta .hljs-keyword,
          .hljs-template-tag,
          .hljs-template-variable,
          .hljs-type,
          .hljs-variable.language_ {
            color: #ff7b72;
          }
          .hljs-title,
          .hljs-title.class_,
          .hljs-title.class_.inherited__,
          .hljs-title.function_ {
            color: #d2a8ff;
          }
          .hljs-attr,
          .hljs-attribute,
          .hljs-literal,
          .hljs-meta,
          .hljs-number,
          .hljs-operator,
          .hljs-variable,
          .hljs-selector-attr,
          .hljs-selector-class,
          .hljs-selector-id {
            color: #79c0ff;
          }
          .hljs-regexp,
          .hljs-string,
          .hljs-meta .hljs-string {
            color: #a5d6ff;
          }
          .hljs-built_in,
          .hljs-symbol {
            color: #ffa657;
          }
          .hljs-comment,
          .hljs-code,
          .hljs-formula {
            color: #8b949e;
          }
          .hljs-name,
          .hljs-quote,
          .hljs-selector-tag,
          .hljs-selector-pseudo {
            color: #7ee787;
          }
          .hljs-subst {
            color: #c9d1d9;
          }
          .hljs-section {
            color: #1f6feb;
            font-weight: bold;
          }
          .hljs-bullet {
            color: #f2cc60;
          }
          .hljs-emphasis {
            color: #c9d1d9;
            font-style: italic;
          }
          .hljs-strong {
            color: #c9d1d9;
            font-weight: bold;
          }
          .hljs-addition {
            color: #aff5b4;
            background-color: #033a16;
          }
          .hljs-deletion {
            color: #ffdcd7;
            background-color: #67060c;
          }

          /* KaTeX Custom Dark Theme */
          .katex-display {
            margin: 1rem 0 !important;
            padding: 1rem !important;
            background-color: #101624 !important;
            border: 1px solid #233056 !important;
            border-radius: 0.5rem !important;
            overflow-x: auto !important;
          }
          .katex {
            color: #7dd3fc !important;
            font-size: 1.1em !important;
          }
          .katex .mord,
          .katex .mop,
          .katex .mrel,
          .katex .mbin,
          .katex .mpunct,
          .katex .mopen,
          .katex .mclose,
          .katex .minner {
            color: #7dd3fc !important;
          }
          .katex .mfrac .frac-line {
            border-bottom-color: #7dd3fc !important;
          }
          .katex .sqrt > .root {
            color: #7dd3fc !important;
          }
          .katex .msupsub {
            color: #7dd3fc !important;
          }
          .katex .arraycolsep {
            color: #7dd3fc !important;
          }
          .katex .delimsizing,
          .katex .delim-size1,
          .katex .delim-size2,
          .katex .delim-size3,
          .katex .delim-size4 {
            color: #7dd3fc !important;
          }
          .katex .op-symbol {
            color: #7dd3fc !important;
          }
          .katex .mathit {
            color: #93c5fd !important;
          }
          .katex .mop {
            color: #60a5fa !important;
          }
          .katex .mord.mathnormal {
            color: #ddd6fe !important;
          }
          .katex .mbin,
          .katex .mrel {
            color: #fbbf24 !important;
          }
          .katex-html {
            color: #7dd3fc !important;
          }
        `}</style>
      </Head>
      <body className="bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
        <Main />
        <NextScript />
      </body>
    </Html>
  )
} 