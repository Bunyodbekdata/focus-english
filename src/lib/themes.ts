export type ThemeId = "sage" | "ocean" | "warm" | "lavender" | "forest";

export interface ThemeDefinition {
  id: ThemeId;
  name: string;
  description: string;
  isDark: boolean;
  swatch: {
    sky: string;
    hillBack: string;
    hillFront: string;
    accent: string;
  };
}

export const DEFAULT_THEME: ThemeId = "sage";

export const THEME_STORAGE_KEY = "focus-english-theme";

export const THEMES: ThemeDefinition[] = [
  {
    id: "sage",
    name: "Sage Green",
    description: "Natural and Calm",
    isDark: false,
    swatch: {
      sky: "#D7E8DD",
      hillBack: "#78B093",
      hillFront: "#347056",
      accent: "#347056",
    },
  },
  {
    id: "ocean",
    name: "Ocean Blue",
    description: "Cool and Peaceful",
    isDark: false,
    swatch: {
      sky: "#D4E7F5",
      hillBack: "#72A8CE",
      hillFront: "#2F6D96",
      accent: "#2F6D96",
    },
  },
  {
    id: "warm",
    name: "Warm Sand",
    description: "Warm and Soft",
    isDark: false,
    swatch: {
      sky: "#F1DEC0",
      hillBack: "#CA9856",
      hillFront: "#8C6230",
      accent: "#8C6230",
    },
  },
  {
    id: "lavender",
    name: "Soft Lavender",
    description: "Light and Peaceful",
    isDark: false,
    swatch: {
      sky: "#E2D7F8",
      hillBack: "#9F88D1",
      hillFront: "#69529E",
      accent: "#69529E",
    },
  },
  {
    id: "forest",
    name: "Dark Forest",
    description: "Dark and Comfortable",
    isDark: true,
    swatch: {
      sky: "#1B2E26",
      hillBack: "#35614D",
      hillFront: "#6EC49D",
      accent: "#6EC49D",
    },
  },
];

export function isValidTheme(value: unknown): value is ThemeId {
  return (
    value === "sage" ||
    value === "ocean" ||
    value === "warm" ||
    value === "lavender" ||
    value === "forest"
  );
}
