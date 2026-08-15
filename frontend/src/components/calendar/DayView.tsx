import React from "react";
import { Box, Typography, Paper, Chip, useTheme } from "@mui/material";
import { AccessTime, Person, AttachMoney, Notes, EventRepeat } from "@mui/icons-material";
import type { Appointment } from "../../types";

export interface DayViewProps {
  currentDate: Date;
  appointments: Appointment[];
  onSlotClick: (startDate: Date, endDate: Date) => void;
  onAppointmentClick: (appointment: Appointment, e: React.MouseEvent<HTMLElement>) => void;
}

const HOURS = Array.from({ length: 17 }, (_, i) => i + 6); // 06:00 to 22:00

const getLocalYMD = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const STATUS_COLORS: Record<string, "info" | "success" | "default"> = {
  scheduled: "info",
  completed: "success",
  cancelled: "default",
};

export const DayView: React.FC<DayViewProps> = ({
  currentDate,
  appointments,
  onSlotClick,
  onAppointmentClick,
}) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";

  const dateStr = getLocalYMD(currentDate);

  // Filter appointments for this date
  const dayAppts = appointments.filter((a) => {
    const apptDateStr = getLocalYMD(new Date(a.startTime));
    return apptDateStr === dateStr;
  });

  const handleCellClick = (hour: number) => {
    const start = new Date(currentDate);
    start.setHours(hour, 0, 0, 0);
    const end = new Date(start);
    end.setHours(hour + 1, 0, 0, 0);
    onSlotClick(start, end);
  };

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        borderRadius: "16px",
        overflow: "hidden",
        backgroundColor: isDark
          ? "rgba(26, 31, 58, 0.7)"
          : "#ffffff",
        border: isDark
          ? "1px solid rgba(255,255,255,0.08)"
          : "1px solid #e5e5ea",
        boxShadow: isDark
          ? "0 4px 20px rgba(0,0,0,0.15)"
          : "0 2px 12px rgba(0,0,0,0.04)",
      }}
    >
      {/* Day View Header */}
      <Box
        sx={{
          p: 2,
          backgroundColor: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)",
          borderBottom: isDark ? "1px solid rgba(255,255,255,0.08)" : "1px solid #e5e5ea",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Typography variant="h6" sx={{ fontWeight: 700, color: "text.primary" }}>
          {currentDate.toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
            year: "numeric",
          })}
        </Typography>
        <Typography variant="caption" sx={{ color: "text.secondary", fontWeight: 600 }}>
          {dayAppts.length} {dayAppts.length === 1 ? "Appointment" : "Appointments"}
        </Typography>
      </Box>

      {/* Grid: Time Slots & Detailed Appointment List */}
      <Box
        sx={{
          flex: 1,
          overflowY: "auto",
          display: "grid",
          gridTemplateColumns: "80px 1fr",
          position: "relative",
        }}
      >
        {/* Time Labels Column */}
        <Box sx={{ borderRight: isDark ? "1px solid rgba(255,255,255,0.08)" : "1px solid #e5e5ea" }}>
          {HOURS.map((hour) => {
            const timeLabel = new Date(0, 0, 0, hour).toLocaleTimeString("en-US", {
              hour: "numeric",
              hour12: true,
            });
            return (
              <Box
                key={hour}
                sx={{
                  height: 90,
                  pr: 1.5,
                  pt: 1,
                  textAlign: "right",
                  fontSize: "0.78rem",
                  fontWeight: 600,
                  color: "text.secondary",
                  borderBottom: isDark ? "1px solid rgba(255,255,255,0.04)" : "1px solid #f0f0f4",
                  boxSizing: "border-box",
                }}
              >
                {timeLabel}
              </Box>
            );
          })}
        </Box>

        {/* Schedule Column */}
        <Box sx={{ position: "relative" }}>
          {HOURS.map((hour) => (
            <Box
              key={hour}
              onClick={() => handleCellClick(hour)}
              sx={{
                height: 90,
                borderBottom: isDark ? "1px solid rgba(255,255,255,0.04)" : "1px solid #f0f0f4",
                boxSizing: "border-box",
                cursor: "pointer",
                transition: "background-color 0.15s ease",
                "&:hover": {
                  backgroundColor: isDark
                    ? "rgba(79, 195, 247, 0.08)"
                    : "rgba(79, 195, 247, 0.06)",
                },
              }}
            />
          ))}

          {/* Render Positioned Detailed Appointment Cards */}
          {dayAppts.map((appt) => {
            const start = new Date(appt.startTime);
            const end = new Date(appt.endTime);

            const startHour = start.getHours() + start.getMinutes() / 60;
            const endHour = end.getHours() + end.getMinutes() / 60;

            const topOffset = Math.max(0, (startHour - 6) * 90);
            const durationMinutes = Math.max(45, (endHour - startHour) * 90);

            const isExternal = appt.source === "google_calendar";
            const startTimeStr = start.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
            const endTimeStr = end.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });

            return (
              <Paper
                key={appt.id}
                elevation={0}
                onClick={(e) => onAppointmentClick(appt, e)}
                sx={{
                  position: "absolute",
                  top: topOffset,
                  height: durationMinutes,
                  left: 12,
                  right: 12,
                  zIndex: 2,
                  p: 1.5,
                  borderRadius: "12px",
                  bgcolor: isDark ? "rgba(26, 31, 58, 0.95)" : "#ffffff",
                  border: isDark ? "1px solid rgba(79, 195, 247, 0.3)" : "1px solid #4FC3F7",
                  boxShadow: "0 4px 16px rgba(79,195,247,0.15)",
                  cursor: "pointer",
                  overflow: "hidden",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  transition: "transform 0.15s ease",
                  "&:hover": {
                    transform: "translateY(-2px)",
                    borderColor: "#4FC3F7",
                  },
                }}
              >
                <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 1 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700, fontSize: "0.95rem", color: "text.primary" }}>
                    {appt.title}
                  </Typography>
                  <Box sx={{ display: "flex", gap: 0.5, alignItems: "center" }}>
                    {isExternal && (
                      <Chip
                        size="small"
                        icon={<EventRepeat sx={{ fontSize: 12 }} />}
                        label="Google"
                        color="info"
                        variant="outlined"
                        sx={{ height: 20, fontSize: "0.7rem" }}
                      />
                    )}
                    <Chip
                      size="small"
                      label={appt.status}
                      color={STATUS_COLORS[appt.status] || "info"}
                      sx={{ height: 20, fontSize: "0.7rem", textTransform: "capitalize" }}
                    />
                  </Box>
                </Box>

                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2, mt: 0.5 }}>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                    <AccessTime sx={{ fontSize: 14, color: "#4FC3F7" }} />
                    <Typography variant="caption" sx={{ fontWeight: 600, color: "text.secondary" }}>
                      {startTimeStr} - {endTimeStr}
                    </Typography>
                  </Box>

                  {appt.customer?.name && (
                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                      <Person sx={{ fontSize: 14, color: "#4FC3F7" }} />
                      <Typography variant="caption" sx={{ fontWeight: 600, color: "text.secondary" }}>
                        {appt.customer.name}
                      </Typography>
                    </Box>
                  )}

                  {appt.price != null && (
                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                      <AttachMoney sx={{ fontSize: 14, color: "#66BB6A" }} />
                      <Typography variant="caption" sx={{ fontWeight: 600, color: "#66BB6A" }}>
                        ${appt.price}
                      </Typography>
                    </Box>
                  )}
                </Box>

                {appt.notes && (
                  <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mt: 0.5 }}>
                    <Notes sx={{ fontSize: 14, color: "text.secondary" }} />
                    <Typography
                      variant="caption"
                      sx={{
                        color: "text.secondary",
                        fontStyle: "italic",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {appt.notes}
                    </Typography>
                  </Box>
                )}
              </Paper>
            );
          })}
        </Box>
      </Box>
    </Box>
  );
};

export default DayView;
