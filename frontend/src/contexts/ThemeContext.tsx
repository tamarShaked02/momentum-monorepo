import React, { useState, useMemo, type ReactNode } from "react";
import {
  createTheme,
  ThemeProvider as MuiThemeProvider,
} from "@mui/material/styles";
import { CssBaseline } from "@mui/material";
import { ThemeContext, type Mode } from "./themeContext";

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
        default: mode === "dark" ? "#0a0e27" : "#d8dce8",
        paper: mode === "dark" ? "#1a1f3a" : "#e2e6f0",
      },
      text: {
        primary: mode === "dark" ? "#E8EAED" : "#1e2235",
        secondary: mode === "dark" ? "#9AA0B4" : "#4a5068",
      },
    },
    typography: {
      fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
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
            background:
              mode === "dark"
                ? "rgba(26, 31, 58, 0.7)"
                : "rgba(200, 205, 225, 0.6)",
            backdropFilter: mode === "dark" ? "blur(12px)" : "blur(8px)",
            border:
              mode === "dark"
                ? "1px solid rgba(255,255,255,0.08)"
                : "1px solid rgba(100,110,150,0.15)",
            transition: "transform 0.2s ease, box-shadow 0.2s ease",
            "&:hover": {
              transform: "translateY(-2px)",
              boxShadow: "0 8px 32px rgba(79, 195, 247, 0.15)",
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
                mode === "dark" ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.04)",
              "& fieldset": {
                borderColor:
                  mode === "dark"
                    ? "rgba(255,255,255,0.12)"
                    : "rgba(80,90,130,0.2)",
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
            background: mode === "dark" ? "rgba(10, 14, 39, 0.95)" : "#cdd1e0",
            backdropFilter: mode === "dark" ? "blur(20px)" : "none",
            borderRight:
              mode === "dark"
                ? "1px solid rgba(255,255,255,0.06)"
                : "1px solid rgba(80,90,130,0.15)",
          },
        },
      },
      MuiAppBar: {
        styleOverrides: {
          root: {
            background:
              mode === "dark"
                ? "rgba(10, 14, 39, 0.8)"
                : "rgba(210, 215, 230, 0.9)",
            backdropFilter: "blur(20px)",
            borderBottom:
              mode === "dark"
                ? "1px solid rgba(255,255,255,0.06)"
                : "1px solid rgba(80,90,130,0.15)",
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
