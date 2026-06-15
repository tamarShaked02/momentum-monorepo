import React, { useState, useRef } from "react";
import {
  Box,
  TextField,
  Button,
  IconButton,
  Tooltip,
  Paper,
  Typography,
  CircularProgress,
} from "@mui/material";
import {
  FormatBold,
  FormatItalic,
  FormatListBulleted,
  FormatListNumbered,
  Send,
} from "@mui/icons-material";
import { createActivity } from "../../api/crm";
import type { Activity, ActivityCreateData } from "../../types/crm";

interface InlineNoteComposerProps {
  contactId?: string;
  dealId?: string;
  onNoteCreated?: (activity: Activity) => void;
}

/**
 * InlineNoteComposer – a quick note entry at the top of the activity timeline.
 * Supports basic markdown-like formatting (bold, italic, bulleted/numbered lists).
 * Validates non-empty before submission and submits as activity type "note".
 *
 * Validates: Requirements 3.8, 3.9, 3.12, 13.2
 */
const InlineNoteComposer: React.FC<InlineNoteComposerProps> = ({
  contactId,
  dealId,
  onNoteCreated,
}) => {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  /**
   * Insert formatting markers around the current selection or at cursor position.
   */
  const applyFormat = (prefix: string, suffix: string) => {
    const textarea = inputRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = text.substring(start, end);

    const newText =
      text.substring(0, start) +
      prefix +
      selected +
      suffix +
      text.substring(end);
    setText(newText);

    // Restore focus and cursor position after the inserted prefix
    setTimeout(() => {
      textarea.focus();
      const cursorPos = start + prefix.length + selected.length;
      textarea.setSelectionRange(cursorPos, cursorPos);
    }, 0);
  };

  /**
   * Insert list prefix at the beginning of the current line or selection.
   */
  const applyListFormat = (type: "bullet" | "number") => {
    const textarea = inputRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = text.substring(start, end);

    let formatted: string;
    if (selected) {
      // Apply list formatting to each selected line
      const lines = selected.split("\n");
      formatted = lines
        .map((line, i) =>
          type === "bullet" ? `• ${line}` : `${i + 1}. ${line}`,
        )
        .join("\n");
    } else {
      // Insert a single list item
      formatted = type === "bullet" ? "• " : "1. ";
    }

    const newText = text.substring(0, start) + formatted + text.substring(end);
    setText(newText);

    setTimeout(() => {
      textarea.focus();
      const cursorPos = start + formatted.length;
      textarea.setSelectionRange(cursorPos, cursorPos);
    }, 0);
  };

  const handleBold = () => applyFormat("**", "**");
  const handleItalic = () => applyFormat("_", "_");
  const handleBulletList = () => applyListFormat("bullet");
  const handleNumberList = () => applyListFormat("number");

  const handleSubmit = async () => {
    // Validate non-empty
    if (!text.trim()) {
      setError("Note content is required");
      return;
    }

    setError(null);
    setSubmitting(true);

    try {
      const activityData: ActivityCreateData = {
        type: "note",
        description: text,
        contactId: contactId || null,
        dealId: dealId || null,
      };

      const activity = await createActivity(activityData);

      // Clear input after successful submission
      setText("");
      setError(null);

      // Notify parent to refresh the timeline
      if (onNoteCreated) {
        onNoteCreated(activity);
      }
    } catch {
      setError("Failed to save note. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Submit on Ctrl+Enter or Cmd+Enter
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <Paper
      elevation={0}
      sx={{
        p: 2,
        mb: 2,
        bgcolor: "background.paper",
        border: 1,
        borderColor: "divider",
        borderRadius: 2,
      }}
    >
      <Typography
        variant="subtitle2"
        sx={{ mb: 1, color: "text.secondary", fontWeight: 600 }}
      >
        Quick Note
      </Typography>

      {/* Formatting Toolbar */}
      <Box
        sx={{
          display: "flex",
          gap: 0.5,
          mb: 1,
          borderBottom: 1,
          borderColor: "divider",
          pb: 1,
        }}
      >
        <Tooltip title="Bold (Ctrl+B)">
          <IconButton
            size="small"
            onClick={handleBold}
            aria-label="Bold"
            sx={{ color: "text.secondary" }}
          >
            <FormatBold fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Italic (Ctrl+I)">
          <IconButton
            size="small"
            onClick={handleItalic}
            aria-label="Italic"
            sx={{ color: "text.secondary" }}
          >
            <FormatItalic fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Bulleted List">
          <IconButton
            size="small"
            onClick={handleBulletList}
            aria-label="Bulleted list"
            sx={{ color: "text.secondary" }}
          >
            <FormatListBulleted fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Numbered List">
          <IconButton
            size="small"
            onClick={handleNumberList}
            aria-label="Numbered list"
            sx={{ color: "text.secondary" }}
          >
            <FormatListNumbered fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Text Input */}
      <TextField
        inputRef={inputRef}
        multiline
        minRows={2}
        maxRows={6}
        fullWidth
        placeholder="Write a note..."
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          if (error) setError(null);
        }}
        onKeyDown={handleKeyDown}
        error={!!error}
        helperText={error}
        disabled={submitting}
        sx={{
          "& .MuiOutlinedInput-root": {
            bgcolor: "background.default",
          },
        }}
      />

      {/* Submit Button */}
      <Box sx={{ display: "flex", justifyContent: "flex-end", mt: 1 }}>
        <Button
          variant="contained"
          size="small"
          onClick={handleSubmit}
          disabled={submitting}
          startIcon={
            submitting ? (
              <CircularProgress size={16} />
            ) : (
              <Send fontSize="small" />
            )
          }
          aria-label="Submit note"
        >
          {submitting ? "Saving..." : "Add Note"}
        </Button>
      </Box>
    </Paper>
  );
};

export default InlineNoteComposer;
