import React, { useState } from "react";
import {
  Box,
  TextField,
  Popover,
  Typography,
  IconButton,
  Button,
  MenuItem,
  Select,
  useTheme,
} from "@mui/material";
import { CalendarToday, ChevronLeft, ChevronRight, AccessTime } from "@mui/icons-material";

export interface DatePickerInputProps {
  label: string;
  value: string; // "YYYY-MM-DD" or "YYYY-MM-DDTHH:mm"
  onChange: (value: string) => void;
  type?: "date" | "datetime-local";
  fullWidth?: boolean;
  required?: boolean;
  size?: "small" | "medium";
  error?: boolean;
  helperText?: string;
  placeholder?: string;
}

const WEEKDAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export const DatePickerInput: React.FC<DatePickerInputProps> = ({
  label,
  value,
  onChange,
  type = "date",
  fullWidth = true,
  required = false,
  size = "small",
  error = false,
  helperText,
  placeholder,
}) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";

  // Parse initial date from value or fallback to today
  const parseDateFromValue = (val: string): Date => {
    if (!val) return new Date();
    const d = new Date(val);
    return isNaN(d.getTime()) ? new Date() : d;
  };

  const selectedDate = parseDateFromValue(value);
  const [viewDate, setViewDate] = useState<Date>(selectedDate);
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

  // Time state for datetime-local
  const [hours, setHours] = useState<number>(selectedDate.getHours());
  const [minutes, setMinutes] = useState<number>(selectedDate.getMinutes());

  const handleOpenPopover = (e: React.MouseEvent<HTMLElement>) => {
    const current = parseDateFromValue(value);
    setViewDate(current);
    setHours(current.getHours());
    setMinutes(current.getMinutes());
    setAnchorEl(e.currentTarget);
  };

  const handleClosePopover = () => {
    setAnchorEl(null);
  };

  // Format display label in input text box
  const formatDisplayValue = (val: string): string => {
    if (!val) return "";
    const d = new Date(val);
    if (isNaN(d.getTime())) return val;

    if (type === "datetime-local") {
      return d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    }
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  // Month navigation in mini-calendar
  const handlePrevMonth = () => {
    setViewDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setViewDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  // Select day handler
  const handleSelectDay = (dayNum: number) => {
    const newDate = new Date(viewDate.getFullYear(), viewDate.getMonth(), dayNum, hours, minutes);
    emitValue(newDate);
    if (type === "date") {
      handleClosePopover();
    }
  };

  const emitValue = (dateObj: Date) => {
    const y = dateObj.getFullYear();
    const m = String(dateObj.getMonth() + 1).padStart(2, "0");
    const d = String(dateObj.getDate()).padStart(2, "0");

    if (type === "datetime-local") {
      const hh = String(hours).padStart(2, "0");
      const mm = String(minutes).padStart(2, "0");
      onChange(`${y}-${m}-${d}T${hh}:${mm}`);
    } else {
      onChange(`${y}-${m}-${d}`);
    }
  };

  const handleTimeChange = (newHours: number, newMinutes: number) => {
    setHours(newHours);
    setMinutes(newMinutes);
    const newDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate(), newHours, newMinutes);
    emitValue(newDate);
  };

  // Generate mini-calendar grid matrix
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const daysMatrix: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) {
    daysMatrix.push(null);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    daysMatrix.push(d);
  }

  const isOpen = Boolean(anchorEl);

  return (
    <Box sx={{ width: fullWidth ? "100%" : "auto" }}>
      <TextField
        label={label}
        value={formatDisplayValue(value)}
        onClick={handleOpenPopover}
        fullWidth={fullWidth}
        required={required}
        size={size}
        error={error}
        helperText={helperText}
        placeholder={placeholder || (type === "date" ? "Select Date" : "Select Date & Time")}
        slotProps={{
          input: {
            readOnly: true,
            endAdornment: (
              <IconButton size="small" onClick={handleOpenPopover} edge="end">
                {type === "date" ? (
                  <CalendarToday fontSize="small" sx={{ color: "#4FC3F7" }} />
                ) : (
                  <AccessTime fontSize="small" sx={{ color: "#4FC3F7" }} />
                )}
              </IconButton>
            ),
            sx: {
              cursor: "pointer",
              fontFamily: "'Poppins', sans-serif",
            },
          },
        }}
      />

      <Popover
        open={isOpen}
        anchorEl={anchorEl}
        onClose={handleClosePopover}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
        transformOrigin={{ vertical: "top", horizontal: "left" }}
        slotProps={{
          paper: {
            sx: {
              p: 2,
              width: 300,
              borderRadius: "16px",
              backgroundColor: isDark ? "rgba(26, 31, 58, 0.95)" : "#ffffff",
              border: isDark ? "1px solid rgba(255,255,255,0.12)" : "1px solid #e5e5ea",
              boxShadow: "0 12px 32px rgba(0,0,0,0.25)",
            },
          },
        }}
      >
        {/* Header: Month & Navigation */}
        <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", mb: 1.5 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, color: "text.primary" }}>
            {viewDate.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
          </Typography>
          <Box sx={{ display: "flex", gap: 0.5 }}>
            <IconButton size="small" onClick={handlePrevMonth}>
              <ChevronLeft fontSize="small" />
            </IconButton>
            <IconButton size="small" onClick={handleNextMonth}>
              <ChevronRight fontSize="small" />
            </IconButton>
          </Box>
        </Box>

        {/* Weekday Labels (Sun-Sat) */}
        <Box sx={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", textWrap: "nowrap", textAlign: "center", mb: 1 }}>
          {WEEKDAYS_SHORT.map((wd) => (
            <Typography key={wd} variant="caption" sx={{ fontWeight: 600, color: "text.secondary", fontSize: "0.72rem" }}>
              {wd}
            </Typography>
          ))}
        </Box>

        {/* Mini Calendar Grid */}
        <Box sx={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 0.5, mb: type === "datetime-local" ? 2 : 0 }}>
          {daysMatrix.map((dayNum, idx) => {
            if (dayNum === null) {
              return <Box key={`empty-${idx}`} />;
            }

            const isSelected =
              selectedDate.getFullYear() === year &&
              selectedDate.getMonth() === month &&
              selectedDate.getDate() === dayNum;

            const isToday =
              new Date().getFullYear() === year &&
              new Date().getMonth() === month &&
              new Date().getDate() === dayNum;

            return (
              <Box
                key={dayNum}
                onClick={() => handleSelectDay(dayNum)}
                sx={{
                  height: 32,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: "8px",
                  fontSize: "0.825rem",
                  fontWeight: isSelected || isToday ? 700 : 500,
                  cursor: "pointer",
                  backgroundColor: isSelected
                    ? "#4FC3F7"
                    : isToday
                    ? isDark
                      ? "rgba(79, 195, 247, 0.2)"
                      : "rgba(79, 195, 247, 0.15)"
                    : "transparent",
                  color: isSelected
                    ? "#ffffff"
                    : isToday
                    ? "#4FC3F7"
                    : "text.primary",
                  transition: "all 0.15s ease",
                  "&:hover": {
                    backgroundColor: isSelected ? "#3baee2" : isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.04)",
                  },
                }}
              >
                {dayNum}
              </Box>
            );
          })}
        </Box>

        {/* Time Selector for datetime-local */}
        {type === "datetime-local" && (
          <Box sx={{ borderTop: isDark ? "1px solid rgba(255,255,255,0.08)" : "1px solid #e5e5ea", pt: 1.5 }}>
            <Typography variant="caption" sx={{ fontWeight: 600, color: "text.secondary", display: "block", mb: 1 }}>
              Select Time
            </Typography>
            <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
              <Select
                size="small"
                value={hours}
                onChange={(e) => handleTimeChange(Number(e.target.value), minutes)}
                sx={{ flex: 1, fontSize: "0.85rem" }}
              >
                {Array.from({ length: 24 }, (_, i) => (
                  <MenuItem key={i} value={i}>
                    {String(i).padStart(2, "0")}:00
                  </MenuItem>
                ))}
              </Select>

              <Select
                size="small"
                value={minutes}
                onChange={(e) => handleTimeChange(hours, Number(e.target.value))}
                sx={{ flex: 1, fontSize: "0.85rem" }}
              >
                {[0, 15, 30, 45].map((m) => (
                  <MenuItem key={m} value={m}>
                    :{String(m).padStart(2, "0")}
                  </MenuItem>
                ))}
              </Select>
            </Box>

            <Button
              fullWidth
              variant="contained"
              size="small"
              onClick={handleClosePopover}
              sx={{ mt: 1.5, borderRadius: "8px", fontWeight: 600 }}
            >
              Done
            </Button>
          </Box>
        )}
      </Popover>
    </Box>
  );
};

export default DatePickerInput;
