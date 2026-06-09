import React from "react";
import { Box, Typography, useTheme } from "@mui/material";
import { Notes, Google } from "@mui/icons-material";
import type { Appointment } from "../../types";
import { STATUS_COLORS } from "./constants";

export interface EventCardProps {
  appointment: Appointment;
  isExternal: boolean;
  onClick: (appointment: Appointment) => void;
  isDraggable: boolean;
}

const EventCard: React.FC<EventCardProps> = ({
  appointment,
  isExternal,
  onClick,
  isDraggable,
}) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const statusColor = STATUS_COLORS[appointment.status] || "#9AA0B4";
  const hasNotes = !!appointment.notes;

  const formatTime = (iso: string) => {
    const date = new Date(iso);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <Box
      data-testid="event-card"
      onClick={() => onClick(appointment)}
      sx={{
        width: "100%",
        padding: "6px 8px",
        borderRadius: "16px",
        borderLeft: `4px solid ${statusColor}`,
        borderStyle: isExternal ? "dashed" : "solid",
        borderWidth: isExternal ? "1px" : undefined,
        borderColor: isExternal ? statusColor : undefined,
        borderLeftStyle: isExternal ? "dashed" : "solid",
        borderLeftWidth: "4px",
        borderLeftColor: statusColor,
        background: isDark
          ? "rgba(26, 31, 58, 0.7)"
          : "rgba(255, 255, 255, 0.9)",
        backdropFilter: "blur(12px)",
        boxShadow: isDark ? "none" : "0 1px 3px rgba(0,0,0,0.08)",
        opacity: isExternal ? 0.7 : 1,
        cursor: isDraggable ? "grab" : "pointer",
        transition: "transform 0.2s ease, box-shadow 0.2s ease",
        overflow: "hidden",
        position: "relative",
        "&:hover": {
          transform: "translateY(-1px)",
          boxShadow: `0 4px 16px ${statusColor}26`,
        },
      }}
    >
      {/* Title row with icons */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 0.5,
          mb: 0.25,
        }}
      >
        <Typography
          variant="caption"
          sx={{
            fontWeight: 600,
            color: isDark ? "#E8EAED" : "#1a1a1a",
            fontSize: "0.75rem",
            lineHeight: 1.3,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            flex: 1,
          }}
        >
          {appointment.title}
        </Typography>
        {isExternal && (
          <Google
            data-testid="google-icon"
            sx={{
              fontSize: 14,
              color: isDark ? "#9AA0B4" : "#6e6e73",
              flexShrink: 0,
            }}
          />
        )}
        {hasNotes && (
          <Notes
            data-testid="notes-icon"
            sx={{
              fontSize: 14,
              color: isDark ? "#9AA0B4" : "#6e6e73",
              flexShrink: 0,
            }}
          />
        )}
      </Box>

      {/* Time range */}
      <Typography
        variant="caption"
        data-testid="event-time"
        sx={{
          color: isDark ? "#9AA0B4" : "#6e6e73",
          fontSize: "0.65rem",
          lineHeight: 1.2,
          display: "block",
        }}
      >
        {formatTime(appointment.startTime)} – {formatTime(appointment.endTime)}
      </Typography>

      {/* Customer name */}
      {appointment.customer?.name && (
        <Typography
          variant="caption"
          data-testid="event-customer"
          sx={{
            color: isDark ? "#9AA0B4" : "#6e6e73",
            fontSize: "0.65rem",
            lineHeight: 1.2,
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

export default EventCard;
