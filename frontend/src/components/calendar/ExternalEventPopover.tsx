import React from "react";
import {
  Box,
  Typography,
  Popover,
  Link,
  Divider,
  useTheme,
} from "@mui/material";
import { Google, OpenInNew, AccessTime } from "@mui/icons-material";
import type { Appointment } from "../../types";

export interface ExternalEventPopoverProps {
  appointment: Appointment;
  anchorEl: HTMLElement | null;
  onClose: () => void;
}

const ExternalEventPopover: React.FC<ExternalEventPopoverProps> = ({
  appointment,
  anchorEl,
  onClose,
}) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const open = Boolean(anchorEl);

  const formatTime = (iso: string) => {
    const date = new Date(iso);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const googleCalendarUrl = appointment.googleEventId
    ? `https://calendar.google.com/calendar/event?eid=${appointment.googleEventId}`
    : "https://calendar.google.com";

  return (
    <Popover
      open={open}
      anchorEl={anchorEl}
      onClose={onClose}
      anchorOrigin={{
        vertical: "bottom",
        horizontal: "left",
      }}
      transformOrigin={{
        vertical: "top",
        horizontal: "left",
      }}
      slotProps={{
        paper: {
          sx: {
            background: isDark ? "rgba(26, 31, 58, 0.9)" : "#ffffff",
            backdropFilter: isDark ? "blur(12px)" : "none",
            borderRadius: "12px",
            border: isDark
              ? "1px solid rgba(255, 255, 255, 0.08)"
              : "1px solid #e5e5ea",
            boxShadow: isDark
              ? "0 8px 32px rgba(0, 0, 0, 0.4)"
              : "0 4px 16px rgba(0, 0, 0, 0.1)",
            minWidth: 280,
            maxWidth: 340,
            p: 2.5,
          },
        },
      }}
    >
      {/* Header with Google icon */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.5 }}>
        <Google sx={{ fontSize: 20, color: "#4FC3F7" }} />
        <Typography
          variant="subtitle1"
          sx={{
            fontWeight: 600,
            color: isDark ? "#E8EAED" : "#1a1a1a",
            lineHeight: 1.3,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            flex: 1,
          }}
        >
          {appointment.title}
        </Typography>
      </Box>

      {/* Time display */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
        <AccessTime
          sx={{ fontSize: 16, color: isDark ? "#9AA0B4" : "#6e6e73" }}
        />
        <Typography
          variant="body2"
          data-testid="external-event-time"
          sx={{ color: isDark ? "#9AA0B4" : "#6e6e73" }}
        >
          {formatTime(appointment.startTime)} –{" "}
          {formatTime(appointment.endTime)}
        </Typography>
      </Box>

      <Divider
        sx={{
          borderColor: isDark ? "rgba(255, 255, 255, 0.08)" : "#e5e5ea",
          mb: 2,
        }}
      />

      {/* Edit message */}
      <Typography
        variant="body2"
        sx={{
          color: isDark ? "#9AA0B4" : "#6e6e73",
          mb: 2,
          fontStyle: "italic",
        }}
      >
        Edit this event in Google Calendar
      </Typography>

      {/* View in Google Calendar link */}
      <Link
        href={googleCalendarUrl}
        target="_blank"
        rel="noopener noreferrer"
        underline="none"
        data-testid="view-in-google-link"
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 0.5,
          color: "#4FC3F7",
          fontSize: "0.875rem",
          fontWeight: 500,
          "&:hover": {
            color: "#80D8FF",
          },
        }}
      >
        View in Google Calendar
        <OpenInNew sx={{ fontSize: 14 }} />
      </Link>
    </Popover>
  );
};

export default ExternalEventPopover;
