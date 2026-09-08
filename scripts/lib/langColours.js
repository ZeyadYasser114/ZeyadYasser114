"use strict";

// Small, static fallback palette so the languages card doesn't depend on
// fetching linguist's colors.yml from the network at render time.
// GraphQL already returns each language's official color for most repos;
// this only fills gaps.
module.exports = {
  Java: "#b07219",
  Python: "#3572A5",
  "C++": "#f34b7d",
  "C": "#555555",
  Assembly: "#6E4C13",
  JavaScript: "#f1e05a",
  TypeScript: "#3178c6",
  HTML: "#e34c26",
  CSS: "#563d7c",
  Shell: "#89e051",
  Dockerfile: "#384d54",
  default: "#ffffff",
};
