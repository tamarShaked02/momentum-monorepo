import { createContext, useContext } from "react";

export type Mode = "dark" | "light";

export interface ThemeContextType {
  mode: Mode;
  toggleMode: () => void;
}

export const ThemeContext = createContext<ThemeContextType>({
  mode: "dark",
  toggleMode: () => {},
});

export const useThemeMode = () => useContext(ThemeContext);
