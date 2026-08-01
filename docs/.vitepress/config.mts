import { defineConfig } from "vitepress";

export default defineConfig({
  // "VolunteerReady", not "VolunteerMatch" — the latter is a COMPETITOR (see the
  // landscape list in DESIGN.md). The site shipped under the competitor's name from
  // the day it was scaffolded.
  title: "VolunteerReady",
  description: "Product and engineering docs",
  lang: "en-US",

  // These docs are an engineering log, not hand-authored VitePress pages: they quote
  // JSX (`style={{ … }}`), Prisma fragments and template literals in prose. Vue's SFC
  // compiler treats `{{ … }}` as an interpolation and fails the WHOLE build on the
  // first one — `{{ fontFamily: '…' }}` parses as a type annotation, not an expression,
  // and the failure names a post-transform line number that does not match the source.
  // Moving the delimiters somewhere no document will ever type disables interpolation
  // in practice, which is what we want: nothing here is a Vue template. Without this,
  // every future `{{` written into any doc breaks `pnpm docs:build`.
  //
  // TRADEOFF, stated so nobody rediscovers it the hard way: this turns OFF standard
  // Vue interpolation site-wide. A `{{ … }}` example copied from the stock VitePress
  // docs will render literally instead of evaluating. That is the right trade while
  // these files are an engineering log that quotes code far more often than it
  // templates — but if a doc ever genuinely needs interpolation, use `[[[[ … ]]]]`
  // rather than reverting this, or the whole build goes back to failing on prose.
  vue: {
    template: {
      compilerOptions: { delimiters: ["[[[[", "]]]]"] },
    },
  },

  themeConfig: {
    // The previous nav pointed at six `/guide/*` stubs deleted in 3109623 (2026-03-09,
    // "cleaned up docs/guide"); the nav was never updated, so every link 404'd for
    // ~5 months. `docs:build` is not in CI, so nothing caught it. These link to docs
    // that exist — if you delete one, update this file in the same commit.
    nav: [
      { text: "Orientation", link: "/AI_CONTEXT" },
      { text: "Architecture", link: "/ARCHITECTURE" },
      { text: "Domain", link: "/DOMAIN" },
      { text: "Roadmap", link: "/ROADMAP" },
    ],
    sidebar: [
      {
        text: "Orientation",
        items: [
          { text: "AI Context", link: "/AI_CONTEXT" },
          { text: "Agent Rules", link: "/AGENT_RULES" },
        ],
      },
      {
        text: "Architecture",
        items: [
          { text: "Architecture", link: "/ARCHITECTURE" },
          { text: "Domain Model", link: "/DOMAIN" },
          { text: "Request Flow", link: "/REQUEST_FLOW" },
          { text: "System Diagram", link: "/SYSTEM_DIAGRAM" },
        ],
      },
      {
        text: "Planning",
        items: [
          { text: "Roadmap", link: "/ROADMAP" },
          { text: "TODOs", link: "/TODOS" },
        ],
      },
    ],
  },
});
