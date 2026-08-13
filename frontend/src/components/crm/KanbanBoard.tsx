import React, { useCallback, useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
  useDroppable,
} from "@dnd-kit/core";
import type {
  DragStartEvent,
  DragOverEvent,
  DragEndEvent,
} from "@dnd-kit/core";
import { Box, Typography, useTheme } from "@mui/material";
import type { Deal, Stage } from "../../types/crm";
import DealCard from "./DealCard";

// ─── Props ───────────────────────────────────────────────────────────────────

export interface KanbanBoardFilters {
  contactId?: string;
  expectedCloseDateFrom?: string;
  expectedCloseDateTo?: string;
  minValue?: number;
}

export interface KanbanBoardProps {
  pipelineId: string;
  deals: Deal[];
  stages: Stage[];
  onDealMoved: (dealId: string, stageId: string) => Promise<void>;
  onDealClick?: (deal: Deal) => void;
  filters?: KanbanBoardFilters;
}

// ─── Helper: format currency ─────────────────────────────────────────────────

function formatCurrency(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toLocaleString()}`;
}

// ─── DragOverlay Card (elevated during drag) ─────────────────────────────────

const DragOverlayCard: React.FC<{ deal: Deal }> = ({ deal }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";

  return (
    <Box
      sx={{
        p: 1.5,
        borderRadius: 1,
        cursor: "grabbing",
        minWidth: 240,
        transform: "rotate(2deg)",
        backgroundColor: isDark
          ? "rgba(26, 31, 58, 0.9)"
          : theme.palette.background.paper,
        backdropFilter: isDark ? "blur(16px)" : "none",
        border: isDark
          ? "1px solid rgba(79, 195, 247, 0.3)"
          : `1px solid ${theme.palette.divider}`,
        boxShadow: isDark
          ? "0 12px 40px rgba(79, 195, 247, 0.2), 0 0 0 1px rgba(79, 195, 247, 0.15)"
          : "0 12px 40px rgba(0,0,0,0.15), 0 4px 12px rgba(0,0,0,0.1)",
      }}
    >
      {/* Title */}
      <Typography
        variant="body2"
        noWrap
        sx={{
          fontWeight: 600,
          color: theme.palette.text.primary,
          mb: 0.75,
        }}
      >
        {deal.title}
      </Typography>

      {/* Value */}
      {deal.value != null && (
        <Typography
          variant="body2"
          sx={{
            fontWeight: 700,
            color: theme.palette.primary.main,
            mb: 0.75,
            fontSize: "0.875rem",
          }}
        >
          {formatCurrency(deal.value)}
        </Typography>
      )}

      {/* Contact */}
      {deal.contact?.name && (
        <Typography
          variant="caption"
          noWrap
          sx={{ color: theme.palette.text.secondary }}
        >
          {deal.contact.name}
        </Typography>
      )}
    </Box>
  );
};

// ─── StageColumn (droppable) ─────────────────────────────────────────────────

interface StageColumnProps {
  stage: Stage;
  deals: Deal[];
  isOver: boolean;
  onDealClick?: (dealId: string) => void;
  activeDealId: string | null;
}

const StageColumn: React.FC<StageColumnProps> = ({
  stage,
  deals,
  isOver,
  onDealClick,
  activeDealId,
}) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";

  const { setNodeRef } = useDroppable({ id: stage.id });

  const totalValue = useMemo(
    () => deals.reduce((sum, d) => sum + (d.value ?? 0), 0),
    [deals],
  );

  return (
    <Box
      ref={setNodeRef}
      data-testid={`stage-column-${stage.id}`}
      sx={{
        display: "flex",
        flexDirection: "column",
        minWidth: 280,
        maxWidth: 320,
        flex: "1 0 280px",
        height: "100%",
        borderRadius: 1,
        backgroundColor: isOver
          ? isDark
            ? "rgba(79, 195, 247, 0.08)"
            : "rgba(79, 195, 247, 0.06)"
          : isDark
            ? "rgba(255,255,255,0.02)"
            : theme.palette.background.paper,
        border: isOver
          ? `2px dashed ${theme.palette.primary.main}`
          : `1px solid ${theme.palette.divider}`,
        transition: "background-color 0.2s ease, border 0.2s ease",
        p: 1.5,
      }}
    >
      {/* Column Header */}
      <Box sx={{ mb: 1.5 }}>
        <Typography
          variant="subtitle2"
          sx={{
            fontWeight: 600,
            color: theme.palette.text.primary,
            mb: 0.25,
          }}
        >
          {stage.name}
        </Typography>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Typography
            variant="caption"
            sx={{ color: theme.palette.text.secondary }}
          >
            {deals.length} {deals.length === 1 ? "deal" : "deals"}
          </Typography>
          <Typography
            variant="caption"
            sx={{ color: theme.palette.success.main, fontWeight: 500 }}
          >
            {formatCurrency(totalValue)}
          </Typography>
        </Box>
      </Box>

      {/* Cards container */}
      <Box
        sx={{
          flex: 1,
          overflowY: "auto",
          minHeight: 60,
          display: "flex",
          flexDirection: "column",
          gap: 1.5,
          "&::-webkit-scrollbar": { width: 4 },
          "&::-webkit-scrollbar-thumb": {
            backgroundColor: isDark
              ? "rgba(255,255,255,0.1)"
              : "rgba(0,0,0,0.1)",
            borderRadius: 1,
          },
        }}
      >
        {deals.map((deal) => (
          <DealCard
            key={deal.id}
            deal={deal}
            isDragging={deal.id === activeDealId}
            onClick={onDealClick}
          />
        ))}
      </Box>
    </Box>
  );
};

// ─── KanbanBoard ─────────────────────────────────────────────────────────────

const KanbanBoard: React.FC<KanbanBoardProps> = ({
  pipelineId: _pipelineId,
  deals,
  stages,
  onDealMoved,
  onDealClick,
  filters,
}) => {
  const theme = useTheme();

  // Optimistic state: local deals for immediate UI updates
  const [localDeals, setLocalDeals] = useState<Deal[]>(deals);
  const [activeDeal, setActiveDeal] = useState<Deal | null>(null);
  const [overStageId, setOverStageId] = useState<string | null>(null);

  // Sync local deals with parent when props change
  React.useEffect(() => {
    setLocalDeals(deals);
  }, [deals]);

  // Adapter: DealCard fires onClick(dealId), KanbanBoardProps expects onDealClick(deal)
  const handleDealClick = useCallback(
    (dealId: string) => {
      if (!onDealClick) return;
      const deal = localDeals.find((d) => d.id === dealId);
      if (deal) onDealClick(deal);
    },
    [onDealClick, localDeals],
  );

  // Configure sensors with activation distance to differentiate clicks from drags
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
  );

  // Filter deals based on filters prop
  const filteredDeals = useMemo(() => {
    let result = localDeals;

    if (filters?.contactId) {
      result = result.filter((d) => d.contactId === filters.contactId);
    }
    if (filters?.minValue != null) {
      result = result.filter((d) => (d.value ?? 0) >= filters.minValue!);
    }
    if (filters?.expectedCloseDateFrom) {
      const from = new Date(filters.expectedCloseDateFrom);
      result = result.filter(
        (d) => d.expectedCloseDate && new Date(d.expectedCloseDate) >= from,
      );
    }
    if (filters?.expectedCloseDateTo) {
      const to = new Date(filters.expectedCloseDateTo);
      result = result.filter(
        (d) => d.expectedCloseDate && new Date(d.expectedCloseDate) <= to,
      );
    }

    return result;
  }, [localDeals, filters]);

  // Group deals by stage
  const dealsByStage = useMemo(() => {
    const map: Record<string, Deal[]> = {};
    for (const stage of stages) {
      map[stage.id] = [];
    }
    for (const deal of filteredDeals) {
      if (map[deal.stageId]) {
        map[deal.stageId].push(deal);
      }
    }
    return map;
  }, [filteredDeals, stages]);

  // Sorted stages by position
  const sortedStages = useMemo(
    () => [...stages].sort((a, b) => a.position - b.position),
    [stages],
  );

  // ─── Drag Handlers ─────────────────────────────────────────────────

  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const dealId = event.active.id as string;
      const deal = localDeals.find((d) => d.id === dealId) ?? null;
      setActiveDeal(deal);
    },
    [localDeals],
  );

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const overId = event.over?.id as string | null;
    setOverStageId(overId ?? null);
  }, []);

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const dealId = event.active.id as string;
      const targetStageId = event.over?.id as string | undefined;

      // Reset drag visual state
      setActiveDeal(null);
      setOverStageId(null);

      // Invalid drop: no target, return card to original position
      if (!targetStageId) return;

      // Find the deal
      const deal = localDeals.find((d) => d.id === dealId);
      if (!deal) return;

      // Validate target is a valid stage in this pipeline
      const validStageIds = stages.map((s) => s.id);
      if (!validStageIds.includes(targetStageId)) return;

      // Same stage: no-op
      if (deal.stageId === targetStageId) return;

      // Optimistic update: immediately move card to new column
      const previousStageId = deal.stageId;
      setLocalDeals((prev) =>
        prev.map((d) =>
          d.id === dealId ? { ...d, stageId: targetStageId } : d,
        ),
      );

      // Call API — revert on failure
      try {
        await onDealMoved(dealId, targetStageId);
      } catch {
        // API failure: revert the card to its original position
        setLocalDeals((prev) =>
          prev.map((d) =>
            d.id === dealId ? { ...d, stageId: previousStageId } : d,
          ),
        );
      }
    },
    [localDeals, stages, onDealMoved],
  );

  const handleDragCancel = useCallback(() => {
    setActiveDeal(null);
    setOverStageId(null);
  }, []);

  // ─── Render ────────────────────────────────────────────────────────

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <Box
        data-testid="kanban-board"
        sx={{
          display: "flex",
          gap: 2,
          height: "100%",
          pb: 1,
          // Responsive: horizontal at ≥768px, horizontal scroll at <768px
          [theme.breakpoints.up("md")]: {
            flexWrap: "nowrap",
            overflowX: "auto",
          },
          [theme.breakpoints.down("md")]: {
            overflowX: "auto",
            flexWrap: "nowrap",
          },
          "&::-webkit-scrollbar": { height: 6 },
          "&::-webkit-scrollbar-thumb": {
            backgroundColor:
              theme.palette.mode === "dark"
                ? "rgba(255,255,255,0.1)"
                : "rgba(0,0,0,0.1)",
            borderRadius: 3,
          },
        }}
      >
        {sortedStages.map((stage) => (
          <StageColumn
            key={stage.id}
            stage={stage}
            deals={dealsByStage[stage.id] ?? []}
            isOver={overStageId === stage.id}
            onDealClick={handleDealClick}
            activeDealId={activeDeal?.id ?? null}
          />
        ))}
      </Box>

      {/* Drag Overlay: floating elevated card during drag */}
      <DragOverlay dropAnimation={null}>
        {activeDeal ? <DragOverlayCard deal={activeDeal} /> : null}
      </DragOverlay>
    </DndContext>
  );
};

export default KanbanBoard;
