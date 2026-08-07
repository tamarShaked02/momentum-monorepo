import { createTheme } from "@mui/material/styles";

const theme = createTheme({
  palette: {
    mode: "dark",
    primary: {
      main: "#4FC3F7",
      light: "#80D8FF",
      dark: "#0288D1",
    },
    secondary: {
      main: "#FFB74D",
      light: "#FFD54F",
      dark: "#F57C00",
    },
    error: {
      main: "#FF6B6B",
    },
    success: {
      main: "#66BB6A",
    },
    warning: {
      main: "#FFB74D",
    },
    background: {
      default: "#0a0e27",
      paper: "#1a1f3a",
    },
    text: {
      primary: "#E8EAED",
      secondary: "#9AA0B4",
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
  shape: {
    borderRadius: 16,
  },
  components: {
    MuiCard: {
      styleOverrides: {
        root: {
          background: "rgba(26, 31, 58, 0.7)",
          backdropFilter: "blur(12px)",
          border: "1px solid rgba(255,255,255,0.08)",
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
        root: {
          borderRadius: 12,
          padding: "10px 24px",
          fontSize: "0.95rem",
        },
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
            background: "rgba(255,255,255,0.03)",
            "& fieldset": {
              borderColor: "rgba(255,255,255,0.12)",
            },
            "&:hover fieldset": {
              borderColor: "rgba(79, 195, 247, 0.5)",
            },
          },
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: "none",
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        paper: {
          background: "rgba(10, 14, 39, 0.95)",
          backdropFilter: "blur(20px)",
          borderRight: "1px solid rgba(255,255,255,0.06)",
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          background: "rgba(10, 14, 39, 0.8)",
          backdropFilter: "blur(20px)",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          boxShadow: "none",
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: {
          borderRadius: 8,
        },
      },
    },
  },
});

export default theme;
