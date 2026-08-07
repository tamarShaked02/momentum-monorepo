import React, {
  createContext,
  useContext,
  useState,
  useMemo,
  type ReactNode,
} from "react";
import {
  createTheme,
  ThemeProvider as MuiThemeProvider,
} from "@mui/material/styles";
import { CssBaseline } from "@mui/material";

type Mode = "dark" | "light";

interface ThemeContextType {
  mode: Mode;
  toggleMode: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
  mode: "dark",
  toggleMode: () => { },
});

// eslint-disable-next-line react-refresh/only-export-components
export const useThemeMode = () => useContext(ThemeContext);

const buildTheme = (mode: Mode) =>
  createTheme({
    palette: {
      mode,
      primary: { main: "#4FC3F7", light: "#80D8FF", dark: "#0288D1" },
      secondary: { main: "#FFB74D", light: "#FFD54F", dark: "#F57C00" },
      error: { main: "#FF6B6B" },
      success: { main: "#66BB6A" },
      warning: { main: "#FFB74D" },
      background: {
        default: mode === "dark" ? "#0a0e27" : "#f2f2f7",
        paper: mode === "dark" ? "#1a1f3a" : "#ffffff",
      },
      text: {
        primary: mode === "dark" ? "#E8EAED" : "#000000",
        secondary: mode === "dark" ? "#9AA0B4" : "#6e6e73",
      },
    },
    typography: {
      fontFamily: '"Poppins", "Inter", "Roboto", "Helvetica", "Arial", sans-serif',
      h4: { fontWeight: 700 },
      h5: { fontWeight: 600 },
      h6: { fontWeight: 600 },
      subtitle1: { fontWeight: 500 },
      button: { textTransform: "none", fontWeight: 600 },
    },
    shape: { borderRadius: 16 },
    components: {
      MuiCard: {
        styleOverrides: {
          root: {
            background: mode === "dark" ? "rgba(26, 31, 58, 0.7)" : "#ffffff",
            backdropFilter: mode === "dark" ? "blur(12px)" : "none",
            border:
              mode === "dark" ? "1px solid rgba(255,255,255,0.08)" : "none",
            boxShadow:
              mode === "dark"
                ? "none"
                : "0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)",
            transition: "transform 0.2s ease, box-shadow 0.2s ease",
            "&:hover": {
              transform: "translateY(-2px)",
              boxShadow:
                mode === "dark"
                  ? "0 8px 32px rgba(79, 195, 247, 0.15)"
                  : "0 4px 12px rgba(0,0,0,0.1)",
            },
          },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: { borderRadius: 12, padding: "10px 24px", fontSize: "0.95rem" },
          contained: {
            background: "linear-gradient(135deg, #4FC3F7 0%, #0288D1 100%)",
            boxShadow: "0 4px 16px rgba(79, 195, 247, 0.3)",
            color: "#ffffff",
            "&:hover": {
              background: "linear-gradient(135deg, #80D8FF 0%, #4FC3F7 100%)",
              boxShadow: "0 6px 24px rgba(79, 195, 247, 0.4)",
            },
          },
        },
      },
      MuiTextField: {
        styleOverrides: {
          root: {
            "& .MuiOutlinedInput-root": {
              borderRadius: 12,
              background:
                mode === "dark" ? "rgba(255,255,255,0.03)" : "#f9f9f9",
              "& fieldset": {
                borderColor:
                  mode === "dark" ? "rgba(255,255,255,0.12)" : "#d1d1d6",
              },
              "&:hover fieldset": { borderColor: "rgba(79, 195, 247, 0.5)" },
            },
          },
        },
      },
      MuiPaper: {
        styleOverrides: { root: { backgroundImage: "none" } },
      },
      MuiDrawer: {
        styleOverrides: {
          paper: {
            background: mode === "dark" ? "rgba(10, 14, 39, 0.95)" : "#ffffff",
            backdropFilter: mode === "dark" ? "blur(20px)" : "none",
            borderRight:
              mode === "dark"
                ? "1px solid rgba(255,255,255,0.06)"
                : "1px solid #e5e5ea",
          },
        },
      },
      MuiAppBar: {
        styleOverrides: {
          root: {
            background:
              mode === "dark"
                ? "rgba(10, 14, 39, 0.8)"
                : "rgba(249, 249, 249, 0.94)",
            backdropFilter: "blur(20px)",
            borderBottom:
              mode === "dark"
                ? "1px solid rgba(255,255,255,0.06)"
                : "1px solid #e5e5ea",
            boxShadow: "none",
          },
        },
      },
      MuiChip: {
        styleOverrides: { root: { borderRadius: 8 } },
      },
    },
  });

export const ThemeProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const stored = (localStorage.getItem("momentum_theme") as Mode) || "dark";
  const [mode, setMode] = useState<Mode>(stored);

  const toggleMode = () => {
    setMode((prev) => {
      const next = prev === "dark" ? "light" : "dark";
      localStorage.setItem("momentum_theme", next);
      return next;
    });
  };

  const theme = useMemo(() => buildTheme(mode), [mode]);

  return (
    <ThemeContext.Provider value={{ mode, toggleMode }}>
      <MuiThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </MuiThemeProvider>
    </ThemeContext.Provider>
  );
};
