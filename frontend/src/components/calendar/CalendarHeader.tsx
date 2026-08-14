import React from "react";
import {
  Box,
  Typography,
  Button,
  IconButton,
  ToggleButtonGroup,
  ToggleButton,
  useTheme,
} from "@mui/material";
import { ChevronLeft, ChevronRight, Today } from "@mui/icons-material";

export type CalendarViewMode = "month" | "week" | "day";

export interface CalendarHeaderProps {
  currentDate: Date;
  viewMode: CalendarViewMode;
  onViewModeChange: (mode: CalendarViewMode) => void;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
}

function formatHeaderTitle(date: Date, viewMode: CalendarViewMode): string {
  if (viewMode === "month") {
    return date.toLocaleDateString("en-US", {
      month: "long",
      year: "numeric",
    });
  }

  if (viewMode === "week") {
    // Calculate start and end of week (Sunday to Saturday)
    const startOfWeek = new Date(date);
    startOfWeek.setDate(date.getDate() - date.getDay());
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 6);

    const sameMonth = startOfWeek.getMonth() === endOfWeek.getMonth();
    const sameYear = startOfWeek.getFullYear() === endOfWeek.getFullYear();

    if (sameMonth && sameYear) {
      const monthName = startOfWeek.toLocaleDateString("en-US", { month: "short" });
      return `${monthName} ${startOfWeek.getDate()} - ${endOfWeek.getDate()}, ${startOfWeek.getFullYear()}`;
    } else if (sameYear) {
      const startMonth = startOfWeek.toLocaleDateString("en-US", { month: "short" });
      const endMonth = endOfWeek.toLocaleDateString("en-US", { month: "short" });
      return `${startMonth} ${startOfWeek.getDate()} - ${endMonth} ${endOfWeek.getDate()}, ${startOfWeek.getFullYear()}`;
    } else {
      const startStr = startOfWeek.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
      const endStr = endOfWeek.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
      return `${startStr} - ${endStr}`;
    }
  }

  // Day view
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

export const CalendarHeader: React.FC<CalendarHeaderProps> = ({
  currentDate,
  viewMode,
  onViewModeChange,
  onPrev,
  onNext,
  onToday,
}) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        mb: 2.5,
        flexWrap: "wrap",
        gap: 2,
        p: 2,
        borderRadius: "16px",
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
      {/* Navigation Controls */}
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
        <Button
          variant="outlined"
          size="small"
          startIcon={<Today fontSize="small" />}
          onClick={onToday}
          sx={{
            borderRadius: "10px",
            textTransform: "none",
            fontWeight: 600,
            borderColor: isDark ? "rgba(255,255,255,0.15)" : "#d1d1d6",
            color: "text.primary",
            "&:hover": {
              borderColor: "#4FC3F7",
              color: "#4FC3F7",
              backgroundColor: "rgba(79,195,247,0.08)",
            },
          }}
        >
          Today
        </Button>

        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
          <IconButton
            size="small"
            onClick={onPrev}
            aria-label="Previous range"
            sx={{
              border: isDark ? "1px solid rgba(255,255,255,0.12)" : "1px solid #d1d1d6",
              borderRadius: "8px",
              color: "text.primary",
              "&:hover": { borderColor: "#4FC3F7", color: "#4FC3F7" },
            }}
          >
            <ChevronLeft fontSize="small" />
          </IconButton>
          <IconButton
            size="small"
            onClick={onNext}
            aria-label="Next range"
            sx={{
              border: isDark ? "1px solid rgba(255,255,255,0.12)" : "1px solid #d1d1d6",
              borderRadius: "8px",
              color: "text.primary",
              "&:hover": { borderColor: "#4FC3F7", color: "#4FC3F7" },
            }}
          >
            <ChevronRight fontSize="small" />
          </IconButton>
        </Box>

        <Typography
          variant="h6"
          sx={{
            fontWeight: 700,
            fontSize: { xs: "1.05rem", sm: "1.25rem" },
            color: "text.primary",
            ml: 1,
          }}
        >
          {formatHeaderTitle(currentDate, viewMode)}
        </Typography>
      </Box>

      {/* View Switcher */}
      <ToggleButtonGroup
        value={viewMode}
        exclusive
        onChange={(_e, newView) => newView && onViewModeChange(newView)}
        size="small"
        aria-label="Calendar view mode"
        sx={{
          bgcolor: isDark ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)",
          p: 0.5,
          borderRadius: "12px",
          border: isDark ? "1px solid rgba(255,255,255,0.08)" : "1px solid #e5e5ea",
          "& .MuiToggleButton-root": {
            border: "none",
            borderRadius: "8px !important",
            px: 2,
            py: 0.5,
            fontSize: "0.85rem",
            fontWeight: 600,
            textTransform: "none",
            color: "text.secondary",
            "&.Mui-selected": {
              backgroundColor: "#4FC3F7",
              color: "#ffffff",
              boxShadow: "0 2px 8px rgba(79,195,247,0.4)",
              "&:hover": {
                backgroundColor: "#3baee2",
              },
            },
          },
        }}
      >
        <ToggleButton value="month">Month</ToggleButton>
        <ToggleButton value="week">Week</ToggleButton>
        <ToggleButton value="day">Day</ToggleButton>
      </ToggleButtonGroup>
    </Box>
  );
};

export default CalendarHeader;
