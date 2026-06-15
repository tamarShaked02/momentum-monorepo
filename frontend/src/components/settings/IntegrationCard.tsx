import React from "react";
import { Box, Typography, Chip, useTheme } from "@mui/material";

export interface IntegrationCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  connected?: boolean;
  children: React.ReactNode;
}

const IntegrationCard: React.FC<IntegrationCardProps> = ({
  icon,
  title,
  description,
  connected,
  children,
}) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "flex-start",
        gap: 2.5,
        p: 3,
        borderRadius: "16px",
        background: isDark ? "rgba(26, 31, 58, 0.7)" : "#ffffff",
        backdropFilter: isDark ? "blur(12px)" : "none",
        border: isDark
          ? "1px solid rgba(255,255,255,0.08)"
          : "1px solid #e5e5ea",
        boxShadow: isDark ? "none" : "0 1px 3px rgba(0,0,0,0.06)",
        transition: "border-color 0.2s ease, box-shadow 0.2s ease",
        "&:hover": {
          borderColor: isDark
            ? "rgba(79, 195, 247, 0.2)"
            : "rgba(79, 195, 247, 0.4)",
          boxShadow: isDark
            ? "0 4px 20px rgba(79, 195, 247, 0.06)"
            : "0 2px 8px rgba(79, 195, 247, 0.1)",
        },
      }}
    >
      {/* Icon */}
      <Box
        sx={{
          width: 48,
          height: 48,
          borderRadius: "12px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: isDark
            ? "rgba(79, 195, 247, 0.1)"
            : "rgba(79, 195, 247, 0.08)",
          flexShrink: 0,
          "& svg": { fontSize: 24, color: "#4FC3F7" },
        }}
      >
        {icon}
      </Box>

      {/* Content */}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 0.5 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
            {title}
          </Typography>
          {connected !== undefined && (
            <Chip
              label={connected ? "Connected" : "Not connected"}
              size="small"
              sx={{
                height: 22,
                fontSize: "0.7rem",
                fontWeight: 600,
                background: connected
                  ? "rgba(102, 187, 106, 0.15)"
                  : isDark
                    ? "rgba(255,255,255,0.06)"
                    : "rgba(0,0,0,0.04)",
                color: connected ? "#66BB6A" : isDark ? "#9AA0B4" : "#6e6e73",
                border: connected
                  ? "1px solid rgba(102, 187, 106, 0.3)"
                  : "none",
              }}
            />
          )}
        </Box>
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ mb: 2, lineHeight: 1.5 }}
        >
          {description}
        </Typography>
        {children}
      </Box>
    </Box>
  );
};

export default IntegrationCard;
