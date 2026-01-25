import { defineConfig } from "vitepress";

export default defineConfig({
  title: "VolunteerMatch",
  description: "Product and engineering docs",
  lang: "en-US",
  themeConfig: {
    nav: [
      { text: "Guide", link: "/guide/getting-started" },
      { text: "Architecture", link: "/guide/architecture" },
      { text: "tRPC", link: "/guide/trpc" },
    ],
    sidebar: {
      "/guide/": [
        { text: "Getting Started", link: "/guide/getting-started" },
        { text: "Architecture", link: "/guide/architecture" },
        { text: "tRPC", link: "/guide/trpc" },
      ],
    },
  },
});
