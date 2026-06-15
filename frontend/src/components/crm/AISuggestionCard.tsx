import React, { useCallback, useEffect, useState } from "react";
import {
  Box,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  IconButton,
  Skeleton,
  Typography,
} from "@mui/material";
import { Refresh as RefreshIcon } from "@mui/icons-material";
import {
  getContactSuggestion,
  getDealSuggestion,
  getConversationSummary,
} from "../../api/crm";

// ─── Types (match backend response shapes) ───────────────────────────────────

interface SuggestionResponse {
  suggestion: string | null;
  reasoning: string | null;
  reason?: "insufficient_activities" | "service_unavailable";
}

interface SummaryResponse {
  summary: string | null;
  reason?: "insufficient_messages" | "service_unavailable";
}

type SuggestionState =
  | "loading"
  | "available"
  | "unavailable"
  | "threshold_not_met";
type SummaryState =
  | "loading"
  | "available"
  | "unavailable"
  | "insufficient"
  | "idle";

// ─── Props ───────────────────────────────────────────────────────────────────

export interface AISuggestionCardProps {
  contactId?: string;
  dealId?: string;
  showSummary?: boolean;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const SUGGESTION_TYPE_LABELS: Record<string, string> = {
  follow_up_call: "Follow-up Call",
  send_proposal: "Send Proposal",
  schedule_meeting: "Schedule Meeting",
  re_engage_stale: "Re-engage",
  re_engage: "Re-engage",
  close_deal: "Close Deal",
};

function formatSuggestionType(type: string): string {
  return (
    SUGGESTION_TYPE_LABELS[type] ??
    type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

const AISuggestionCard: React.FC<AISuggestionCardProps> = ({
  contactId,
  dealId,
  showSummary = false,
}) => {
  const [suggestionState, setSuggestionState] =
    useState<SuggestionState>("loading");
  const [suggestion, setSuggestion] = useState<SuggestionResponse | null>(null);

  const [summaryState, setSummaryState] = useState<SummaryState>(
    showSummary && contactId ? "loading" : "idle",
  );
  const [summary, setSummary] = useState<SummaryResponse | null>(null);

  // ─── Fetch Suggestion ────────────────────────────────────────────────────

  const fetchSuggestion = useCallback(async () => {
    setSuggestionState("loading");
    try {
      let result: unknown;
      if (dealId) {
        result = await getDealSuggestion(dealId);
      } else if (contactId) {
        result = await getContactSuggestion(contactId);
      } else {
        setSuggestionState("threshold_not_met");
        return;
      }

      const data = result as SuggestionResponse;

      if (data.reason === "insufficient_activities") {
        setSuggestionState("threshold_not_met");
      } else if (data.reason === "service_unavailable" || !data.suggestion) {
        setSuggestionState("unavailable");
      } else {
        setSuggestion(data);
        setSuggestionState("available");
      }
    } catch {
      setSuggestionState("unavailable");
    }
  }, [contactId, dealId]);

  // ─── Fetch Summary ──────────────────────────────────────────────────────

  const fetchSummary = useCallback(async () => {
    if (!showSummary || !contactId) {
      setSummaryState("idle");
      return;
    }
    setSummaryState("loading");
    try {
      const result = (await getConversationSummary(
        contactId,
      )) as unknown as SummaryResponse;

      if (result.reason === "insufficient_messages") {
        setSummaryState("insufficient");
      } else if (result.reason === "service_unavailable" || !result.summary) {
        setSummaryState("unavailable");
      } else {
        setSummary(result);
        setSummaryState("available");
      }
    } catch {
      setSummaryState("unavailable");
    }
  }, [contactId, showSummary]);

  // ─── Effects ────────────────────────────────────────────────────────────

  useEffect(() => {
    fetchSuggestion();
  }, [fetchSuggestion]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  // ─── Render Suggestion Section ──────────────────────────────────────────

  const renderSuggestion = () => {
    if (suggestionState === "loading") {
      return (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
          <Skeleton variant="rounded" width={120} height={24} />
          <Skeleton variant="text" width="80%" />
        </Box>
      );
    }

    if (suggestionState === "threshold_not_met") {
      return (
        <Typography
          variant="body2"
          sx={{ color: "text.secondary", fontStyle: "italic" }}
        >
          Not enough activity data for suggestions
        </Typography>
      );
    }

    if (suggestionState === "unavailable") {
      return (
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            Suggestions temporarily unavailable
          </Typography>
          <IconButton
            size="small"
            onClick={fetchSuggestion}
            aria-label="Refresh suggestion"
            sx={{ color: "primary.main" }}
          >
            <RefreshIcon fontSize="small" />
          </IconButton>
        </Box>
      );
    }

    if (suggestionState === "available" && suggestion) {
      return (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
          <Chip
            label={formatSuggestionType(suggestion.suggestion!)}
            size="small"
            color="primary"
            variant="outlined"
            sx={{ alignSelf: "flex-start" }}
          />
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            {suggestion.reasoning}
          </Typography>
        </Box>
      );
    }

    return null;
  };

  // ─── Render Summary Section ─────────────────────────────────────────────

  const renderSummary = () => {
    if (summaryState === "idle") return null;

    if (summaryState === "loading") {
      return (
        <Box sx={{ mt: 2, pt: 2, borderTop: 1, borderColor: "divider" }}>
          <Typography variant="subtitle2" sx={{ color: "text.primary", mb: 1 }}>
            Conversation Summary
          </Typography>
          <Box sx={{ display: "flex", justifyContent: "center", py: 1 }}>
            <CircularProgress size={20} />
          </Box>
        </Box>
      );
    }

    if (summaryState === "insufficient") {
      return (
        <Box sx={{ mt: 2, pt: 2, borderTop: 1, borderColor: "divider" }}>
          <Typography variant="subtitle2" sx={{ color: "text.primary", mb: 1 }}>
            Conversation Summary
          </Typography>
          <Typography
            variant="body2"
            sx={{ color: "text.secondary", fontStyle: "italic" }}
          >
            Not enough messages for a summary
          </Typography>
        </Box>
      );
    }

    if (summaryState === "unavailable") {
      return (
        <Box sx={{ mt: 2, pt: 2, borderTop: 1, borderColor: "divider" }}>
          <Typography variant="subtitle2" sx={{ color: "text.primary", mb: 1 }}>
            Conversation Summary
          </Typography>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              Summary temporarily unavailable
            </Typography>
            <IconButton
              size="small"
              onClick={fetchSummary}
              aria-label="Refresh summary"
              sx={{ color: "primary.main" }}
            >
              <RefreshIcon fontSize="small" />
            </IconButton>
          </Box>
        </Box>
      );
    }

    if (summaryState === "available" && summary) {
      return (
        <Box sx={{ mt: 2, pt: 2, borderTop: 1, borderColor: "divider" }}>
          <Typography variant="subtitle2" sx={{ color: "text.primary", mb: 1 }}>
            Conversation Summary
          </Typography>
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            {summary.summary}
          </Typography>
        </Box>
      );
    }

    return null;
  };

  // ─── Main Render ────────────────────────────────────────────────────────

  return (
    <Card
      variant="outlined"
      sx={{
        bgcolor: "background.paper",
        borderColor: "divider",
        borderRadius: 2,
      }}
    >
      <CardContent sx={{ "&:last-child": { pb: 2 } }}>
        <Typography
          variant="subtitle2"
          sx={{ color: "text.primary", mb: 1.5, fontWeight: 600 }}
        >
          AI Suggestion
        </Typography>

        {renderSuggestion()}
        {renderSummary()}
      </CardContent>
    </Card>
  );
};

export default AISuggestionCard;
