import React from "react";
import { Box, IconButton, Tooltip, Typography, useTheme } from "@mui/material";
import { Sync, Warning } from "@mui/icons-material";

export interface SyncStatusIndicatorProps {
  lastSyncAt: string | null;
  syncError: string | null;
  onManualSync: () => void;
}

function formatSyncTime(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / 60000);

  if (diffMinutes < 1) return "Just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const SyncStatusIndicator: React.FC<SyncStatusIndicatorProps> = ({
  lastSyncAt,
  syncError,
  onManualSync,
}) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";

  return (
    <Box
      data-testid="sync-status-indicator"
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1,
        padding: "6px 12px",
        borderRadius: "12px",
        background: isDark
          ? "rgba(26, 31, 58, 0.7)"
          : "rgba(245, 245, 247, 0.9)",
        backdropFilter: isDark ? "blur(12px)" : "none",
        border: syncError
          ? "1px solid rgba(255, 107, 107, 0.3)"
          : isDark
            ? "1px solid rgba(255,255,255,0.08)"
            : "1px solid #e5e5ea",
      }}
    >
      {syncError && (
        <Tooltip title={syncError}>
          <Warning
            data-testid="sync-error-icon"
            sx={{ fontSize: 18, color: "#FF6B6B" }}
          />
        </Tooltip>
      )}

      <Typography
        variant="body2"
        data-testid="sync-timestamp"
        sx={{
          color: syncError ? "#FF6B6B" : isDark ? "#9AA0B4" : "#6e6e73",
          fontSize: "0.8rem",
          whiteSpace: "nowrap",
        }}
      >
        {syncError
          ? "Sync error"
          : lastSyncAt
            ? `Synced ${formatSyncTime(lastSyncAt)}`
            : "Not synced"}
      </Typography>

      <Tooltip title="Sync now">
        <IconButton
          data-testid="manual-sync-button"
          size="small"
          onClick={onManualSync}
          sx={{
            color: "#4FC3F7",
            padding: "4px",
            "&:hover": {
              background: "rgba(79, 195, 247, 0.1)",
            },
          }}
        >
          <Sync sx={{ fontSize: 18 }} />
        </IconButton>
      </Tooltip>
    </Box>
  );
};

export default SyncStatusIndicator;
