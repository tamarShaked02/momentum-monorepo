import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Box,
  Typography,
  Chip,
  IconButton,
  Button,
  CircularProgress,
  Tooltip,
} from "@mui/material";
import {
  Phone,
  Email,
  EventNote,
  Notes,
  CalendarToday,
  Telegram,
  TrendingUp,
  CheckCircle,
  SwapHoriz,
  Edit,
  Delete,
  FilterList,
} from "@mui/icons-material";
import { getContactActivities, getActivities } from "../../api/crm";
import type { Activity, ActivityType } from "../../types/crm";
import { ACTIVITY_TYPES } from "../../types/crm";

// --- Props ---

export interface ActivityTimelineProps {
  contactId?: string;
  dealId?: string;
  onEditActivity?: (activity: Activity) => void;
  onDeleteActivity?: (activityId: string) => void;
}

// --- Constants ---

const PAGE_SIZE = 20;

const ACTIVITY_TYPE_LABELS: Record<ActivityType, string> = {
  call: "Call",
  email: "Email",
  meeting: "Meeting",
  note: "Note",
  status_change: "Status Change",
  deal_stage_change: "Deal Stage Change",
  appointment: "Appointment",
  telegram_message: "Telegram",
  task_completed: "Task Completed",
};

const ACTIVITY_TYPE_ICONS: Record<ActivityType, React.ReactElement> = {
  call: <Phone fontSize="small" />,
  email: <Email fontSize="small" />,
  meeting: <EventNote fontSize="small" />,
  note: <Notes fontSize="small" />,
  status_change: <SwapHoriz fontSize="small" />,
  deal_stage_change: <TrendingUp fontSize="small" />,
  appointment: <CalendarToday fontSize="small" />,
  telegram_message: <Telegram fontSize="small" />,
  task_completed: <CheckCircle fontSize="small" />,
};

// --- Helpers ---

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);
  const diffWeeks = Math.floor(diffDays / 7);
  const diffMonths = Math.floor(diffDays / 30);

  if (diffSeconds < 60) return "just now";
  if (diffMinutes < 60)
    return `${diffMinutes} minute${diffMinutes === 1 ? "" : "s"} ago`;
  if (diffHours < 24)
    return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
  if (diffWeeks < 5)
    return `${diffWeeks} week${diffWeeks === 1 ? "" : "s"} ago`;
  if (diffMonths < 12)
    return `${diffMonths} month${diffMonths === 1 ? "" : "s"} ago`;
  return date.toLocaleDateString();
}

// --- Component ---

const ActivityTimeline: React.FC<ActivityTimelineProps> = ({
  contactId,
  dealId,
  onEditActivity,
  onDeleteActivity,
}) => {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [selectedTypes, setSelectedTypes] = useState<Set<ActivityType>>(
    new Set(ACTIVITY_TYPES),
  );
  const [showFilters, setShowFilters] = useState(false);

  // Fetch activities based on props
  const fetchActivities = useCallback(
    async (pageNum: number, append: boolean = false) => {
      if (!contactId && !dealId) return;

      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }

      try {
        let response;

        if (contactId && !dealId) {
          // Use contact activities endpoint — returns combined contact + deal activities
          response = await getContactActivities(contactId, {
            page: pageNum,
            pageSize: PAGE_SIZE,
          });
        } else {
          // Use generic activities endpoint with filters
          const typeFilter =
            selectedTypes.size < ACTIVITY_TYPES.length
              ? Array.from(selectedTypes)
              : undefined;

          response = await getActivities({
            contactId,
            dealId,
            type: typeFilter as ActivityType[] | undefined,
            page: pageNum,
            pageSize: PAGE_SIZE,
            sortBy: "createdAt",
            sortOrder: "desc",
          });
        }

        const newActivities = response.data;
        const totalPages = response.totalPages;

        if (append) {
          setActivities((prev) => [...prev, ...newActivities]);
        } else {
          setActivities(newActivities);
        }

        setHasMore(pageNum < totalPages);
      } catch (error) {
        console.error("Failed to fetch activities:", error);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [contactId, dealId, selectedTypes],
  );

  // Reset and reload on filter or entity change
  useEffect(() => {
    setPage(1);
    setActivities([]);
    setHasMore(true);
    fetchActivities(1, false);
  }, [fetchActivities]);

  // Load more handler
  const handleLoadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchActivities(nextPage, true);
  };

  // Type filter toggle
  const handleToggleType = (type: ActivityType) => {
    setSelectedTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) {
        // Don't allow deselecting all
        if (next.size > 1) {
          next.delete(type);
        }
      } else {
        next.add(type);
      }
      return next;
    });
  };

  // Select/deselect all filter
  const handleSelectAll = () => {
    setSelectedTypes(new Set(ACTIVITY_TYPES));
  };

  // Filter activities client-side when using contact endpoint (which returns all types)
  const filteredActivities = useMemo(() => {
    if (selectedTypes.size === ACTIVITY_TYPES.length) return activities;
    return activities.filter((a) => selectedTypes.has(a.type));
  }, [activities, selectedTypes]);

  // --- Render ---

  if (!contactId && !dealId) {
    return (
      <Box sx={{ p: 2 }}>
        <Typography variant="body2" color="text.secondary">
          No contact or deal selected.
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
      {/* Header with filter toggle */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          mb: 1,
        }}
      >
        <Typography variant="subtitle1" color="text.primary">
          Activity Timeline
        </Typography>
        <Tooltip title="Filter by type">
          <IconButton
            size="small"
            onClick={() => setShowFilters((v) => !v)}
            sx={{
              color: showFilters ? "primary.main" : "text.secondary",
            }}
            aria-label="Toggle activity type filters"
          >
            <FilterList fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Type filter chips */}
      {showFilters && (
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, mb: 1 }}>
          <Chip
            label="All"
            size="small"
            variant={
              selectedTypes.size === ACTIVITY_TYPES.length
                ? "filled"
                : "outlined"
            }
            onClick={handleSelectAll}
            sx={{
              bgcolor:
                selectedTypes.size === ACTIVITY_TYPES.length
                  ? "primary.dark"
                  : "transparent",
              color:
                selectedTypes.size === ACTIVITY_TYPES.length
                  ? "primary.light"
                  : "text.secondary",
              borderColor: "divider",
            }}
          />
          {ACTIVITY_TYPES.map((type) => (
            <Chip
              key={type}
              label={ACTIVITY_TYPE_LABELS[type]}
              size="small"
              icon={ACTIVITY_TYPE_ICONS[type]}
              variant={selectedTypes.has(type) ? "filled" : "outlined"}
              onClick={() => handleToggleType(type)}
              sx={{
                bgcolor: selectedTypes.has(type)
                  ? "primary.dark"
                  : "transparent",
                color: selectedTypes.has(type)
                  ? "primary.light"
                  : "text.secondary",
                borderColor: "divider",
                "& .MuiChip-icon": {
                  color: selectedTypes.has(type)
                    ? "primary.light"
                    : "text.secondary",
                },
              }}
            />
          ))}
        </Box>
      )}

      {/* Loading state */}
      {loading && (
        <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
          <CircularProgress size={28} />
        </Box>
      )}

      {/* Empty state */}
      {!loading && filteredActivities.length === 0 && (
        <Box sx={{ py: 4, textAlign: "center" }}>
          <Typography variant="body2" color="text.secondary">
            No activities found.
          </Typography>
        </Box>
      )}

      {/* Timeline */}
      {!loading && filteredActivities.length > 0 && (
        <Box sx={{ display: "flex", flexDirection: "column" }}>
          {filteredActivities.map((activity) => (
            <ActivityItem
              key={activity.id}
              activity={activity}
              onEdit={onEditActivity}
              onDelete={onDeleteActivity}
            />
          ))}
        </Box>
      )}

      {/* Load more */}
      {hasMore && !loading && filteredActivities.length > 0 && (
        <Box sx={{ display: "flex", justifyContent: "center", pt: 1, pb: 2 }}>
          <Button
            variant="outlined"
            size="small"
            onClick={handleLoadMore}
            disabled={loadingMore}
            sx={{
              borderColor: "divider",
              color: "text.secondary",
              "&:hover": {
                borderColor: "primary.main",
                color: "primary.main",
              },
            }}
          >
            {loadingMore ? <CircularProgress size={16} sx={{ mr: 1 }} /> : null}
            Load More
          </Button>
        </Box>
      )}
    </Box>
  );
};

// --- Activity Item Sub-component ---

interface ActivityItemProps {
  activity: Activity;
  onEdit?: (activity: Activity) => void;
  onDelete?: (activityId: string) => void;
}

const ActivityItem: React.FC<ActivityItemProps> = ({
  activity,
  onEdit,
  onDelete,
}) => {
  const canModify = !activity.isSystem;

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "flex-start",
        gap: 1.5,
        py: 1.5,
        px: 1,
        borderBottom: "1px solid",
        borderColor: "divider",
        "&:last-child": {
          borderBottom: "none",
        },
        "&:hover": {
          bgcolor: "action.hover",
          borderRadius: 1,
        },
      }}
    >
      {/* Type icon */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 32,
          height: 32,
          borderRadius: "50%",
          bgcolor: "background.paper",
          border: "1px solid",
          borderColor: "divider",
          flexShrink: 0,
          mt: 0.25,
          color: "primary.main",
        }}
      >
        {ACTIVITY_TYPE_ICONS[activity.type] || <Notes fontSize="small" />}
      </Box>

      {/* Content */}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Box
          sx={{
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            gap: 1,
          }}
        >
          <Typography
            variant="body2"
            color="text.primary"
            sx={{ fontWeight: 500 }}
          >
            {ACTIVITY_TYPE_LABELS[activity.type]}
          </Typography>
          {activity.isSystem && (
            <Chip
              label="System"
              size="small"
              variant="outlined"
              sx={{
                height: 18,
                fontSize: "0.65rem",
                borderColor: "divider",
                color: "text.secondary",
              }}
            />
          )}
        </Box>

        {activity.description && (
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{
              mt: 0.25,
              overflow: "hidden",
              textOverflow: "ellipsis",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
            }}
          >
            {activity.description}
          </Typography>
        )}

        {/* Metadata details */}
        {activity.metadata && Object.keys(activity.metadata).length > 0 && (
          <Box sx={{ mt: 0.5 }}>
            {activity.type === "deal_stage_change" &&
              (activity.metadata as Record<string, string>).fromStage && (
                <Typography variant="caption" color="text.secondary">
                  {(activity.metadata as Record<string, string>).fromStage} →{" "}
                  {(activity.metadata as Record<string, string>).toStage}
                </Typography>
              )}
            {activity.type === "telegram_message" &&
              (activity.metadata as Record<string, string>).direction && (
                <Typography variant="caption" color="text.secondary">
                  {(activity.metadata as Record<string, string>).direction ===
                  "inbound"
                    ? "Received"
                    : "Sent"}
                </Typography>
              )}
          </Box>
        )}

        {/* Timestamp */}
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ mt: 0.5, display: "block" }}
        >
          {formatRelativeTime(activity.createdAt)}
        </Typography>
      </Box>

      {/* Actions — only for user-created (non-system) activities */}
      {canModify && (onEdit || onDelete) && (
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 0.25,
            flexShrink: 0,
          }}
        >
          {onEdit && (
            <Tooltip title="Edit">
              <IconButton
                size="small"
                onClick={() => onEdit(activity)}
                sx={{
                  color: "text.secondary",
                  "&:hover": { color: "primary.main" },
                }}
                aria-label={`Edit activity: ${activity.description || activity.type}`}
              >
                <Edit fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
          {onDelete && (
            <Tooltip title="Delete">
              <IconButton
                size="small"
                onClick={() => onDelete(activity.id)}
                sx={{
                  color: "text.secondary",
                  "&:hover": { color: "error.main" },
                }}
                aria-label={`Delete activity: ${activity.description || activity.type}`}
              >
                <Delete fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </Box>
      )}
    </Box>
  );
};

export default ActivityTimeline;
