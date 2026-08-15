import React, { useState, useEffect, useCallback } from "react";
import { Box } from "@mui/material";
import type { Appointment } from "../../types";
import CalendarHeader, { type CalendarViewMode } from "./CalendarHeader";
import MonthView from "./MonthView";
import WeekView from "./WeekView";
import DayView from "./DayView";

export interface CustomCalendarProps {
  appointments: Appointment[];
  onRangeChange: (startDate: string, endDate: string) => void;
  onSlotClick: (startDate: Date, endDate: Date) => void;
  onAppointmentClick: (appointment: Appointment, targetEl?: HTMLElement) => void;
  initialView?: CalendarViewMode;
}

export const CustomCalendar: React.FC<CustomCalendarProps> = ({
  appointments,
  onRangeChange,
  onSlotClick,
  onAppointmentClick,
  initialView = "week",
}) => {
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [viewMode, setViewMode] = useState<CalendarViewMode>(initialView);

  // Calculate and notify range change whenever currentDate or viewMode updates
  const notifyRangeChange = useCallback(
    (date: Date, mode: CalendarViewMode) => {
      let start: Date;
      let end: Date;

      if (mode === "month") {
        const y = date.getFullYear();
        const m = date.getMonth();
        const firstDay = new Date(y, m, 1);
        const startDayOfWeek = firstDay.getDay();
        start = new Date(y, m, 1 - startDayOfWeek);
        end = new Date(start);
        end.setDate(start.getDate() + 42); // 6 weeks cover
      } else if (mode === "week") {
        start = new Date(date);
        start.setDate(date.getDate() - date.getDay());
        start.setHours(0, 0, 0, 0);
        end = new Date(start);
        end.setDate(start.getDate() + 7);
      } else {
        // Day
        start = new Date(date);
        start.setHours(0, 0, 0, 0);
        end = new Date(date);
        end.setHours(23, 59, 59, 999);
      }

      const getLocalYMD = (d: Date) => {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, "0");
        const day = String(d.getDate()).padStart(2, "0");
        return `${year}-${month}-${day}`;
      };

      const startIso = getLocalYMD(start);
      const endIso = getLocalYMD(end);
      onRangeChange(startIso, endIso);
    },
    [onRangeChange],
  );

  useEffect(() => {
    notifyRangeChange(currentDate, viewMode);
  }, [currentDate, viewMode, notifyRangeChange]);

  const handlePrev = () => {
    setCurrentDate((prev) => {
      const next = new Date(prev);
      if (viewMode === "month") {
        next.setMonth(next.getMonth() - 1);
      } else if (viewMode === "week") {
        next.setDate(next.getDate() - 7);
      } else {
        next.setDate(next.getDate() - 1);
      }
      return next;
    });
  };

  const handleNext = () => {
    setCurrentDate((prev) => {
      const next = new Date(prev);
      if (viewMode === "month") {
        next.setMonth(next.getMonth() + 1);
      } else if (viewMode === "week") {
        next.setDate(next.getDate() + 7);
      } else {
        next.setDate(next.getDate() + 1);
      }
      return next;
    });
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  const handleDateClickInMonth = (date: Date) => {
    const start = new Date(date);
    start.setHours(9, 0, 0, 0);
    const end = new Date(date);
    end.setHours(10, 0, 0, 0);
    onSlotClick(start, end);
  };

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Calendar Navigation & View Header */}
      <CalendarHeader
        currentDate={currentDate}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onPrev={handlePrev}
        onNext={handleNext}
        onToday={handleToday}
      />

      {/* Calendar Grid Body */}
      <Box sx={{ flex: 1, minHeight: 0 }}>
        {viewMode === "month" && (
          <MonthView
            currentDate={currentDate}
            appointments={appointments}
            onDateClick={handleDateClickInMonth}
            onAppointmentClick={(appt, e) => onAppointmentClick(appt, e.currentTarget)}
          />
        )}

        {viewMode === "week" && (
          <WeekView
            currentDate={currentDate}
            appointments={appointments}
            onSlotClick={onSlotClick}
            onAppointmentClick={(appt, e) => onAppointmentClick(appt, e.currentTarget)}
          />
        )}

        {viewMode === "day" && (
          <DayView
            currentDate={currentDate}
            appointments={appointments}
            onSlotClick={onSlotClick}
            onAppointmentClick={(appt, e) => onAppointmentClick(appt, e.currentTarget)}
          />
        )}
      </Box>
    </Box>
  );
};

export default CustomCalendar;
