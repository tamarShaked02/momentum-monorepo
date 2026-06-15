import React, { useState } from "react";
import { Box, Typography, Button, IconButton, useTheme } from "@mui/material";
import { Google, Close, ArrowForward } from "@mui/icons-material";

export interface ReminderBannerProps {
  onNavigateToSettings: () => void;
}

const STORAGE_KEY = "momentum_gcal_banner_dismissed";

const ReminderBanner: React.FC<ReminderBannerProps> = ({
  onNavigateToSettings,
}) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const [dismissed, setDismissed] = useState(() => {
    try {
      return sessionStorage.getItem(STORAGE_KEY) === "true";
    } catch {
      return false;
    }
  });

  if (dismissed) return null;

  const handleDismiss = () => {
    setDismissed(true);
    try {
      sessionStorage.setItem(STORAGE_KEY, "true");
    } catch {
      // sessionStorage unavailable — non-critical
    }
  };

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 2,
        px: 2.5,
        py: 1.5,
        mb: 2,
        borderRadius: "12px",
        background: isDark
          ? "linear-gradient(135deg, rgba(79, 195, 247, 0.08), rgba(79, 195, 247, 0.03))"
          : "linear-gradient(135deg, rgba(79, 195, 247, 0.06), rgba(79, 195, 247, 0.02))",
        border: isDark
          ? "1px solid rgba(79, 195, 247, 0.15)"
          : "1px solid rgba(79, 195, 247, 0.2)",
      }}
    >
      <Google sx={{ color: "#4FC3F7", fontSize: 22, flexShrink: 0 }} />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography
          variant="body2"
          sx={{ fontWeight: 500, color: isDark ? "#E8EAED" : "#1a1a1a" }}
        >
          Connect Google Calendar
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Keep your schedule in sync across platforms
        </Typography>
      </Box>
      <Button
        size="small"
        endIcon={<ArrowForward sx={{ fontSize: 14 }} />}
        onClick={onNavigateToSettings}
        sx={{
          textTransform: "none",
          color: "#4FC3F7",
          fontWeight: 600,
          fontSize: "0.8rem",
          borderRadius: "8px",
          whiteSpace: "nowrap",
          "&:hover": { background: "rgba(79, 195, 247, 0.1)" },
        }}
      >
        Set up
      </Button>
      <IconButton
        size="small"
        onClick={handleDismiss}
        sx={{
          color: isDark ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.3)",
          p: 0.5,
          "&:hover": { color: isDark ? "#E8EAED" : "#1a1a1a" },
        }}
      >
        <Close sx={{ fontSize: 16 }} />
      </IconButton>
    </Box>
  );
};

export default ReminderBanner;
