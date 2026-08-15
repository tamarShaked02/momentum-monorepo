import React, { useState } from "react";
import {
  Box,
  Typography,
  Popover,
  List,
  ListItem,
  useTheme,
} from "@mui/material";
import type { Appointment } from "../../types";
import AppointmentBadge from "./AppointmentBadge";

export interface MonthViewProps {
  currentDate: Date;
  appointments: Appointment[];
  onDateClick: (date: Date) => void;
  onAppointmentClick: (appointment: Appointment, e: React.MouseEvent<HTMLElement>) => void;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const getLocalYMD = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

export const MonthView: React.FC<MonthViewProps> = ({
  currentDate,
  appointments,
  onDateClick,
  onAppointmentClick,
}) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";

  // State for "+N more" popover
  const [overflowAnchorEl, setOverflowAnchorEl] = useState<HTMLElement | null>(null);
  const [overflowDate, setOverflowDate] = useState<Date | null>(null);
  const [overflowAppts, setOverflowAppts] = useState<Appointment[]>([]);

  // Calculate calendar grid dates (Sunday to Saturday)
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const firstDayOfMonth = new Date(year, month, 1);
  const startDayOfWeek = firstDayOfMonth.getDay(); // 0 for Sunday

  const startDate = new Date(year, month, 1 - startDayOfWeek);

  // Generate 35 or 42 grid cells (5 or 6 weeks)
  const days: Date[] = [];
  const curr = new Date(startDate);
  for (let i = 0; i < 35; i++) {
    days.push(new Date(curr));
    curr.setDate(curr.getDate() + 1);
  }

  // Ensure last month week fills 6 weeks if necessary
  if (days[days.length - 1].getMonth() === month) {
    for (let i = 0; i < 7; i++) {
      days.push(new Date(curr));
      curr.setDate(curr.getDate() + 1);
    }
  }

  const todayStr = getLocalYMD(new Date());

  const handleOpenOverflow = (
    e: React.MouseEvent<HTMLElement>,
    date: Date,
    appts: Appointment[],
  ) => {
    e.stopPropagation();
    setOverflowAnchorEl(e.currentTarget);
    setOverflowDate(date);
    setOverflowAppts(appts);
  };

  const handleCloseOverflow = () => {
    setOverflowAnchorEl(null);
    setOverflowDate(null);
    setOverflowAppts([]);
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
      {/* English Weekday Header */}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "repeat(7, 1fr)",
          backgroundColor: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)",
          borderBottom: isDark ? "1px solid rgba(255,255,255,0.08)" : "1px solid #e5e5ea",
        }}
      >
        {WEEKDAYS.map((day) => (
          <Box
            key={day}
            sx={{
              py: 1.25,
              textAlign: "center",
              fontWeight: 700,
              fontSize: "0.85rem",
              color: "text.secondary",
              textTransform: "uppercase",
              letterSpacing: "0.5px",
            }}
          >
            {day}
          </Box>
        ))}
      </Box>

      {/* Days Matrix Grid */}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "repeat(7, 1fr)",
          gridAutoRows: "1fr",
          flex: 1,
          minHeight: 0,
        }}
      >
        {days.map((date) => {
          const dateStr = getLocalYMD(date);
          const isToday = dateStr === todayStr;
          const isCurrentMonth = date.getMonth() === month;

          // Filter appointments for this date
          const dayAppts = appointments.filter((a) => {
            const apptDateStr = getLocalYMD(new Date(a.startTime));
            return apptDateStr === dateStr;
          });

          const maxVisible = 3;
          const visibleAppts = dayAppts.slice(0, maxVisible);
          const hiddenCount = dayAppts.length - maxVisible;

          return (
            <Box
              key={dateStr}
              onClick={() => onDateClick(date)}
              sx={{
                p: 1,
                borderRight: isDark ? "1px solid rgba(255,255,255,0.05)" : "1px solid #f0f0f4",
                borderBottom: isDark ? "1px solid rgba(255,255,255,0.05)" : "1px solid #f0f0f4",
                "&:nth-of-type(7n)": { borderRight: "none" },
                opacity: isCurrentMonth ? 1 : 0.45,
                backgroundColor: isToday
                  ? isDark
                    ? "rgba(79, 195, 247, 0.06)"
                    : "rgba(79, 195, 247, 0.08)"
                  : "transparent",
                cursor: "pointer",
                transition: "background-color 0.15s ease",
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
                minHeight: 100,
                "&:hover": {
                  backgroundColor: isDark
                    ? "rgba(255,255,255,0.04)"
                    : "rgba(0,0,0,0.02)",
                },
              }}
            >
              {/* Day Number Header */}
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  mb: 0.75,
                }}
              >
                <Typography
                  variant="caption"
                  sx={{
                    width: 26,
                    height: 26,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: "50%",
                    fontWeight: isToday ? 700 : 500,
                    fontSize: "0.85rem",
                    bgcolor: isToday ? "#4FC3F7" : "transparent",
                    color: isToday
                      ? "#ffffff"
                      : isCurrentMonth
                      ? "text.primary"
                      : "text.secondary",
                    boxShadow: isToday ? "0 2px 8px rgba(79,195,247,0.5)" : "none",
                  }}
                >
                  {date.getDate()}
                </Typography>
              </Box>

              {/* Appointments Badges Stack */}
              <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5, flex: 1, overflow: "hidden" }}>
                {visibleAppts.map((appt) => (
                  <AppointmentBadge
                    key={appt.id}
                    appointment={appt}
                    compact
                    onClick={(a, e) => onAppointmentClick(a, e)}
                  />
                ))}

                {hiddenCount > 0 && (
                  <Typography
                    variant="caption"
                    onClick={(e) => handleOpenOverflow(e, date, dayAppts)}
                    sx={{
                      color: "#4FC3F7",
                      fontWeight: 700,
                      fontSize: "0.72rem",
                      cursor: "pointer",
                      px: 0.5,
                      pt: 0.25,
                      "&:hover": { textDecoration: "underline" },
                    }}
                  >
                    +{hiddenCount} more
                  </Typography>
                )}
              </Box>
            </Box>
          );
        })}
      </Box>

      {/* Overflow Popover */}
      <Popover
        open={Boolean(overflowAnchorEl)}
        anchorEl={overflowAnchorEl}
        onClose={handleCloseOverflow}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
        transformOrigin={{ vertical: "top", horizontal: "left" }}
        slotProps={{
          paper: {
            sx: {
              p: 1.5,
              maxWidth: 280,
              bgcolor: isDark ? "rgba(26, 31, 58, 0.95)" : "#ffffff",
              border: isDark ? "1px solid rgba(255,255,255,0.1)" : "1px solid #e5e5ea",
              borderRadius: "12px",
              boxShadow: "0 8px 24px rgba(0,0,0,0.2)",
            },
          },
        }}
      >
        {overflowDate && (
          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1, color: "text.primary" }}>
            {overflowDate.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
          </Typography>
        )}
        <List dense disablePadding sx={{ display: "flex", flexDirection: "column", gap: 0.75 }}>
          {overflowAppts.map((appt) => (
            <ListItem key={appt.id} disablePadding>
              <AppointmentBadge
                appointment={appt}
                compact
                onClick={(a, e) => {
                  handleCloseOverflow();
                  onAppointmentClick(a, e);
                }}
              />
            </ListItem>
          ))}
        </List>
      </Popover>
    </Box>
  );
};

export default MonthView;
