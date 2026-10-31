export const meta = (title: string, description: string) => ({
  meta: [
    { title: `${title} — LogicLens` },
    { name: "description", content: description },
    { property: "og:title", content: `${title} — LogicLens` },
    { property: "og:description", content: description },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ],
});
