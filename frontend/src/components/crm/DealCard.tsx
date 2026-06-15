import React from "react";
import { Box, Typography, Chip, LinearProgress } from "@mui/material";
import {
  CalendarToday as CalendarIcon,
  Person as PersonIcon,
} from "@mui/icons-material";
import { useDraggable } from "@dnd-kit/core";
import type { Deal } from "../../types/crm";

// ─── Props ───────────────────────────────────────────────────────────────────

export interface DealCardProps {
  deal: Deal;
  isDragging?: boolean;
  onClick?: (dealId: string) => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatCurrency(value: number | null): string {
  if (value == null) return "—";
  return `$${value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getWinProbabilityColor(
  probability: number,
): "success" | "warning" | "info" | "error" {
  if (probability >= 75) return "success";
  if (probability >= 50) return "warning";
  if (probability >= 25) return "info";
  return "error";
}

// ─── Component ───────────────────────────────────────────────────────────────

const DealCard: React.FC<DealCardProps> = ({
  deal,
  isDragging: isDraggingProp,
  onClick,
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging: isDraggingDnd,
  } = useDraggable({ id: deal.id });

  const dragging = isDraggingProp || isDraggingDnd;

  const style = transform
    ? { transform: `translate(${transform.x}px, ${transform.y}px)` }
    : undefined;

  const handleClick = (e: React.MouseEvent) => {
    // Only fire onClick if not dragging
    if (!dragging && onClick) {
      e.stopPropagation();
      onClick(deal.id);
    }
  };

  return (
    <Box
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={handleClick}
      style={style}
      sx={{
        p: 1.5,
        mb: 1.5,
        borderRadius: 2,
        cursor: dragging ? "grabbing" : "pointer",
        userSelect: "none",
        bgcolor: "background.paper",
        border: "1px solid",
        borderColor: "divider",
        opacity: dragging ? 0.5 : 1,
        transition: "box-shadow 0.2s ease, border-color 0.2s ease",
        "&:hover": {
          borderColor: "primary.main",
          boxShadow: (theme) =>
            theme.palette.mode === "dark"
              ? "0 4px 16px rgba(79, 195, 247, 0.15)"
              : "0 4px 12px rgba(0, 0, 0, 0.1)",
        },
      }}
    >
      {/* Title + Win Probability */}
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          mb: 0.75,
          gap: 1,
        }}
      >
        <Typography
          variant="body2"
          sx={{
            fontWeight: 600,
            color: "text.primary",
            lineHeight: 1.3,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            flex: 1,
          }}
        >
          {deal.title}
        </Typography>

        {deal.winProbability != null && (
          <Chip
            label={`${deal.winProbability}%`}
            size="small"
            color={getWinProbabilityColor(deal.winProbability)}
            variant="outlined"
            sx={{
              height: 20,
              fontSize: "0.65rem",
              fontWeight: 700,
              "& .MuiChip-label": { px: 0.75 },
            }}
          />
        )}
      </Box>

      {/* Deal Value */}
      <Typography
        variant="body2"
        sx={{
          fontWeight: 700,
          color: "primary.main",
          mb: 0.75,
          fontSize: "0.875rem",
        }}
      >
        {formatCurrency(deal.value)}
      </Typography>

      {/* Contact Name */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 0.5,
          mb: 0.5,
        }}
      >
        <PersonIcon
          sx={{ fontSize: 14, color: "text.secondary", flexShrink: 0 }}
        />
        <Typography
          variant="caption"
          sx={{
            color: "text.secondary",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {deal.contact?.name ?? "Unknown contact"}
        </Typography>
      </Box>

      {/* Expected Close Date */}
      {deal.expectedCloseDate && (
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 0.5,
            mb: 0.75,
          }}
        >
          <CalendarIcon
            sx={{ fontSize: 14, color: "text.secondary", flexShrink: 0 }}
          />
          <Typography variant="caption" sx={{ color: "text.secondary" }}>
            {formatDate(deal.expectedCloseDate)}
          </Typography>
        </Box>
      )}

      {/* Win Probability Progress Bar */}
      {deal.winProbability != null && (
        <Box sx={{ mt: 0.5 }}>
          <LinearProgress
            variant="determinate"
            value={deal.winProbability}
            color={getWinProbabilityColor(deal.winProbability)}
            sx={{
              height: 4,
              borderRadius: 2,
              bgcolor: (theme) =>
                theme.palette.mode === "dark"
                  ? "rgba(255, 255, 255, 0.08)"
                  : "rgba(0, 0, 0, 0.08)",
            }}
          />
        </Box>
      )}
    </Box>
  );
};

export default DealCard;
