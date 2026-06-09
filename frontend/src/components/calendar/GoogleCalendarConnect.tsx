import React from "react";
import { Box, Button, Typography, useTheme } from "@mui/material";
import { Google, LinkOff } from "@mui/icons-material";

export interface GoogleCalendarConnectProps {
  isConnected: boolean;
  connectedEmail?: string;
  onConnect: () => void;
  onDisconnect: () => void;
}

const GoogleCalendarConnect: React.FC<GoogleCalendarConnectProps> = ({
  isConnected,
  connectedEmail,
  onConnect,
  onDisconnect,
}) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";

  if (isConnected) {
    return (
      <Box
        data-testid="google-calendar-connected"
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1.5,
          padding: "8px 16px",
          borderRadius: "12px",
          background: isDark
            ? "rgba(26, 31, 58, 0.7)"
            : "rgba(245, 245, 247, 0.9)",
          backdropFilter: isDark ? "blur(12px)" : "none",
          border: isDark
            ? "1px solid rgba(255,255,255,0.08)"
            : "1px solid #e5e5ea",
        }}
      >
        <Google sx={{ fontSize: 20, color: "#4FC3F7" }} />
        <Typography
          variant="body2"
          data-testid="connected-email"
          sx={{
            color: isDark ? "#E8EAED" : "#1a1a1a",
            fontSize: "0.85rem",
            fontWeight: 500,
          }}
        >
          {connectedEmail}
        </Typography>
        <Button
          data-testid="disconnect-button"
          size="small"
          startIcon={<LinkOff sx={{ fontSize: 16 }} />}
          onClick={onDisconnect}
          sx={{
            color: "#FF6B6B",
            fontSize: "0.8rem",
            textTransform: "none",
            padding: "4px 12px",
            borderRadius: "8px",
            minWidth: "auto",
            "&:hover": {
              background: "rgba(255, 107, 107, 0.1)",
            },
          }}
        >
          Disconnect
        </Button>
      </Box>
    );
  }

  return (
    <Button
      data-testid="connect-google-button"
      variant="outlined"
      startIcon={<Google />}
      onClick={onConnect}
      sx={{
        borderColor: isDark ? "rgba(255,255,255,0.12)" : "#d1d1d6",
        color: isDark ? "#E8EAED" : "#1a1a1a",
        borderRadius: "12px",
        textTransform: "none",
        padding: "8px 20px",
        fontSize: "0.85rem",
        fontWeight: 500,
        "&:hover": {
          borderColor: "rgba(79, 195, 247, 0.5)",
          background: "rgba(79, 195, 247, 0.08)",
        },
      }}
    >
      Connect Google Calendar
    </Button>
  );
};

export default GoogleCalendarConnect;
