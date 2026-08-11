import React from "react";
import { Box, Typography, Chip, useTheme } from "@mui/material";
import { EventRepeat, AccessTime } from "@mui/icons-material";
import type { Appointment } from "../../types";

export interface AppointmentBadgeProps {
  appointment: Appointment;
  onClick?: (appointment: Appointment, e: React.MouseEvent<HTMLElement>) => void;
  compact?: boolean;
}

const STATUS_COLORS: Record<string, string> = {
  scheduled: "#4FC3F7",
  completed: "#66BB6A",
  cancelled: "#9AA0B4",
};

export const AppointmentBadge: React.FC<AppointmentBadgeProps> = ({
  appointment,
  onClick,
  compact = false,
}) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const isExternal = appointment.source === "google_calendar";

  const startTimeStr = new Date(appointment.startTime).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
  const endTimeStr = new Date(appointment.endTime).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  const mainColor = STATUS_COLORS[appointment.status] || "#4FC3F7";

  const handleClick = (e: React.MouseEvent<HTMLElement>) => {
    e.stopPropagation();
    if (onClick) {
      onClick(appointment, e);
    }
  };

  if (compact) {
    return (
      <Box
        onClick={handleClick}
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 0.5,
          px: 1,
          py: 0.5,
          borderRadius: "6px",
          backgroundColor: isDark
            ? "rgba(255,255,255,0.06)"
            : "rgba(0,0,0,0.04)",
          borderLeft: `3px solid ${mainColor}`,
          cursor: "pointer",
          transition: "all 0.15s ease",
          overflow: "hidden",
          "&:hover": {
            backgroundColor: isDark
              ? "rgba(79,195,247,0.15)"
              : "rgba(79,195,247,0.1)",
            transform: "translateY(-1px)",
          },
        }}
      >
        {isExternal && (
          <EventRepeat
            sx={{ fontSize: 12, color: mainColor, flexShrink: 0 }}
          />
        )}
        <Typography
          variant="caption"
          sx={{
            fontWeight: 600,
            fontSize: "0.72rem",
            color: "text.primary",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            flex: 1,
          }}
        >
          {startTimeStr} {appointment.title}
        </Typography>
      </Box>
    );
  }

  return (
    <Box
      onClick={handleClick}
      sx={{
        p: 1.25,
        borderRadius: "10px",
        backgroundColor: isDark
          ? "rgba(26, 31, 58, 0.9)"
          : "#ffffff",
        border: isDark
          ? "1px solid rgba(255,255,255,0.1)"
          : "1px solid #e5e5ea",
        borderLeft: `4px solid ${mainColor}`,
        boxShadow: isDark
          ? "0 4px 12px rgba(0,0,0,0.2)"
          : "0 2px 8px rgba(0,0,0,0.06)",
        cursor: "pointer",
        transition: "all 0.15s ease",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        boxSizing: "border-box",
        overflow: "hidden",
        "&:hover": {
          borderColor: mainColor,
          boxShadow: `0 4px 16px ${mainColor}33`,
          transform: "translateY(-1px)",
        },
      }}
    >
      <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 0.5, mb: 0.5 }}>
        <Typography
          variant="subtitle2"
          sx={{
            fontWeight: 600,
            fontSize: "0.825rem",
            lineHeight: 1.2,
            color: "text.primary",
            overflow: "hidden",
            textOverflow: "ellipsis",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
          }}
        >
          {appointment.title}
        </Typography>
        {isExternal && (
          <Chip
            size="small"
            icon={<EventRepeat sx={{ fontSize: 11 }} />}
            label="Google"
            sx={{
              height: 18,
              fontSize: "0.625rem",
              bgcolor: isDark ? "rgba(79, 195, 247, 0.15)" : "#e3f2fd",
              color: "#4FC3F7",
              fontWeight: 600,
              "& .MuiChip-icon": { color: "#4FC3F7" },
            }}
          />
        )}
      </Box>

      <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, color: "text.secondary" }}>
        <AccessTime sx={{ fontSize: 12 }} />
        <Typography variant="caption" sx={{ fontSize: "0.72rem", fontWeight: 500 }}>
          {startTimeStr} - {endTimeStr}
        </Typography>
      </Box>

      {appointment.customer?.name && (
        <Typography
          variant="caption"
          sx={{
            color: mainColor,
            fontWeight: 600,
            fontSize: "0.7rem",
            mt: 0.5,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            display: "block",
          }}
        >
          {appointment.customer.name}
        </Typography>
      )}
    </Box>
  );
};

export default AppointmentBadge;
