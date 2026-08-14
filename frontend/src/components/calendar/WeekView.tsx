import React from "react";
import { Box, Typography, useTheme } from "@mui/material";
import type { Appointment } from "../../types";
import AppointmentBadge from "./AppointmentBadge";

export interface WeekViewProps {
  currentDate: Date;
  appointments: Appointment[];
  onSlotClick: (startDate: Date, endDate: Date) => void;
  onAppointmentClick: (appointment: Appointment, e: React.MouseEvent<HTMLElement>) => void;
}

const HOURS = Array.from({ length: 17 }, (_, i) => i + 6); // 06:00 to 22:00

export const WeekView: React.FC<WeekViewProps> = ({
  currentDate,
  appointments,
  onSlotClick,
  onAppointmentClick,
}) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";

  // Calculate days of the current week (Sunday to Saturday)
  const startOfWeek = new Date(currentDate);
  startOfWeek.setDate(currentDate.getDate() - currentDate.getDay());
  startOfWeek.setHours(0, 0, 0, 0);

  const weekDays: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(startOfWeek);
    d.setDate(startOfWeek.getDate() + i);
    weekDays.push(d);
  }

  const todayStr = new Date().toISOString().split("T")[0];

  const handleCellClick = (dayDate: Date, hour: number) => {
    const start = new Date(dayDate);
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
      {/* Header Row: Empty time slot corner + 7 Day Headers */}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "70px repeat(7, 1fr)",
          backgroundColor: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)",
          borderBottom: isDark ? "1px solid rgba(255,255,255,0.08)" : "1px solid #e5e5ea",
        }}
      >
        <Box sx={{ p: 1, borderRight: isDark ? "1px solid rgba(255,255,255,0.08)" : "1px solid #e5e5ea" }} />
        {weekDays.map((dayDate) => {
          const dateStr = dayDate.toISOString().split("T")[0];
          const isToday = dateStr === todayStr;
          const weekdayName = dayDate.toLocaleDateString("en-US", { weekday: "short" });
          const dayNum = dayDate.getDate();

          return (
            <Box
              key={dateStr}
              sx={{
                py: 1.25,
                textAlign: "center",
                borderRight: isDark ? "1px solid rgba(255,255,255,0.05)" : "1px solid #f0f0f4",
                "&:last-child": { borderRight: "none" },
                backgroundColor: isToday
                  ? isDark
                    ? "rgba(79, 195, 247, 0.08)"
                    : "rgba(79, 195, 247, 0.1)"
                  : "transparent",
              }}
            >
              <Typography
                variant="caption"
                sx={{
                  fontWeight: 600,
                  fontSize: "0.75rem",
                  color: isToday ? "#4FC3F7" : "text.secondary",
                  textTransform: "uppercase",
                  display: "block",
                }}
              >
                {weekdayName}
              </Typography>
              <Typography
                variant="subtitle2"
                sx={{
                  fontWeight: 700,
                  fontSize: "1rem",
                  color: isToday ? "#4FC3F7" : "text.primary",
                }}
              >
                {dayNum}
              </Typography>
            </Box>
          );
        })}
      </Box>

      {/* Body: Time slots grid */}
      <Box
        sx={{
          flex: 1,
          overflowY: "auto",
          display: "grid",
          gridTemplateColumns: "70px repeat(7, 1fr)",
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
                  height: 60,
                  pr: 1,
                  pt: 0.5,
                  textAlign: "right",
                  fontSize: "0.72rem",
                  fontWeight: 500,
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

        {/* 7 Day Columns */}
        {weekDays.map((dayDate) => {
          const dateStr = dayDate.toISOString().split("T")[0];
          const isToday = dateStr === todayStr;

          // Filter appointments for this date
          const dayAppts = appointments.filter((a) => {
            const apptDateStr = new Date(a.startTime).toISOString().split("T")[0];
            return apptDateStr === dateStr;
          });

          return (
            <Box
              key={dateStr}
              sx={{
                position: "relative",
                borderRight: isDark ? "1px solid rgba(255,255,255,0.05)" : "1px solid #f0f0f4",
                "&:last-child": { borderRight: "none" },
                backgroundColor: isToday
                  ? isDark
                    ? "rgba(79, 195, 247, 0.02)"
                    : "rgba(79, 195, 247, 0.03)"
                  : "transparent",
              }}
            >
              {/* Hour Grid Lines */}
              {HOURS.map((hour) => (
                <Box
                  key={hour}
                  onClick={() => handleCellClick(dayDate, hour)}
                  sx={{
                    height: 60,
                    borderBottom: isDark ? "1px solid rgba(255,255,255,0.04)" : "1px solid #f0f0f4",
                    boxSizing: "border-box",
                    cursor: "pointer",
                    transition: "background-color 0.15s ease",
                    "&:hover": {
                      backgroundColor: isDark
                        ? "rgba(79, 195, 247, 0.1)"
                        : "rgba(79, 195, 247, 0.08)",
                    },
                  }}
                />
              ))}

              {/* Render Appointments as Absolute Positioned Cards */}
              {dayAppts.map((appt) => {
                const start = new Date(appt.startTime);
                const end = new Date(appt.endTime);

                const startHour = start.getHours() + start.getMinutes() / 60;
                const endHour = end.getHours() + end.getMinutes() / 60;

                const topOffset = Math.max(0, (startHour - 6) * 60);
                const durationMinutes = Math.max(30, (endHour - startHour) * 60);

                return (
                  <Box
                    key={appt.id}
                    sx={{
                      position: "absolute",
                      top: topOffset,
                      height: durationMinutes,
                      left: 4,
                      right: 4,
                      zIndex: 2,
                    }}
                  >
                    <AppointmentBadge
                      appointment={appt}
                      onClick={(a, e) => onAppointmentClick(a, e)}
                    />
                  </Box>
                );
              })}
            </Box>
          );
        })}
      </Box>
    </Box>
  );
};

export default WeekView;
