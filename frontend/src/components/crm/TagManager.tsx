import React, { useState } from "react";
import {
  Box,
  Chip,
  TextField,
  IconButton,
  Snackbar,
  Alert,
  Popover,
  Typography,
  Button,
  useTheme,
} from "@mui/material";
import { Add, Close } from "@mui/icons-material";
import type { ContactTag } from "../../types/crm";
import { addTagToContact, removeTagFromContact } from "../../api/crm";

export interface TagManagerProps {
  contactId: string;
  tags: ContactTag[];
  onTagsChanged?: () => void;
}

const DEFAULT_TAG_COLORS = [
  "#4FC3F7",
  "#66BB6A",
  "#FFB74D",
  "#FF6B6B",
  "#AB47BC",
  "#26A69A",
  "#EC407A",
  "#7E57C2",
];

const TagManager: React.FC<TagManagerProps> = ({
  contactId,
  tags,
  onTagsChanged,
}) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";

  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const [tagName, setTagName] = useState("");
  const [selectedColor, setSelectedColor] = useState<string>(
    DEFAULT_TAG_COLORS[0],
  );
  const [loading, setLoading] = useState(false);
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: "error" | "success";
  }>({ open: false, message: "", severity: "error" });

  const handleOpenAdd = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleCloseAdd = () => {
    setAnchorEl(null);
    setTagName("");
    setSelectedColor(DEFAULT_TAG_COLORS[0]);
  };

  const handleAddTag = async () => {
    const trimmedName = tagName.trim();
    if (!trimmedName) return;

    // Client-side case-insensitive duplicate check
    const isDuplicate = tags.some(
      (ct) => ct.tag?.name.toLowerCase() === trimmedName.toLowerCase(),
    );
    if (isDuplicate) {
      setSnackbar({
        open: true,
        message: `Tag "${trimmedName}" is already assigned to this contact.`,
        severity: "error",
      });
      return;
    }

    setLoading(true);
    try {
      await addTagToContact(contactId, {
        name: trimmedName,
        color: selectedColor,
      });
      handleCloseAdd();
      onTagsChanged?.();
      setSnackbar({
        open: true,
        message: `Tag "${trimmedName}" added successfully.`,
        severity: "success",
      });
    } catch (err: unknown) {
      const error = err as { response?: { status?: number } };
      if (error.response?.status === 400) {
        setSnackbar({
          open: true,
          message: `Tag "${trimmedName}" already exists on this contact.`,
          severity: "error",
        });
      } else {
        setSnackbar({
          open: true,
          message: "Failed to add tag. Please try again.",
          severity: "error",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveTag = async (tagId: string) => {
    try {
      await removeTagFromContact(contactId, tagId);
      onTagsChanged?.();
    } catch {
      setSnackbar({
        open: true,
        message: "Failed to remove tag. Please try again.",
        severity: "error",
      });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddTag();
    }
  };

  const getTagColor = (contactTag: ContactTag): string => {
    if (contactTag.tag?.color) return contactTag.tag.color;
    // Assign a consistent color from the palette based on tag name
    const name = contactTag.tag?.name ?? "";
    const hash = name
      .split("")
      .reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return DEFAULT_TAG_COLORS[hash % DEFAULT_TAG_COLORS.length];
  };

  const open = Boolean(anchorEl);

  return (
    <Box data-testid="tag-manager">
      <Box
        sx={{
          display: "flex",
          flexWrap: "wrap",
          gap: 0.75,
          alignItems: "center",
        }}
      >
        {tags.map((contactTag) => {
          const color = getTagColor(contactTag);
          return (
            <Chip
              key={contactTag.id}
              label={contactTag.tag?.name ?? "Unknown"}
              size="small"
              data-testid={`tag-chip-${contactTag.tagId}`}
              deleteIcon={
                <Close
                  sx={{ fontSize: 14 }}
                  data-testid={`tag-remove-${contactTag.tagId}`}
                />
              }
              onDelete={() => handleRemoveTag(contactTag.tagId)}
              sx={{
                backgroundColor: `${color}22`,
                color: color,
                border: `1px solid ${color}44`,
                fontWeight: 500,
                fontSize: "0.75rem",
                "& .MuiChip-deleteIcon": {
                  color: color,
                  opacity: 0.7,
                  "&:hover": {
                    opacity: 1,
                    color: color,
                  },
                },
              }}
            />
          );
        })}

        <IconButton
          size="small"
          onClick={handleOpenAdd}
          data-testid="add-tag-button"
          sx={{
            width: 28,
            height: 28,
            border: isDark
              ? "1px dashed rgba(255,255,255,0.2)"
              : "1px dashed rgba(0,0,0,0.2)",
            borderRadius: "8px",
            color: theme.palette.text.secondary,
            "&:hover": {
              borderColor: theme.palette.primary.main,
              color: theme.palette.primary.main,
              backgroundColor: `${theme.palette.primary.main}14`,
            },
          }}
        >
          <Add sx={{ fontSize: 16 }} />
        </IconButton>
      </Box>

      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleCloseAdd}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
        transformOrigin={{ vertical: "top", horizontal: "left" }}
        slotProps={{
          paper: {
            sx: {
              p: 2,
              minWidth: 260,
              backgroundColor: theme.palette.background.paper,
              border: isDark
                ? "1px solid rgba(255,255,255,0.08)"
                : "1px solid #e5e5ea",
              borderRadius: "12px",
            },
          },
        }}
      >
        <Typography
          variant="subtitle2"
          sx={{ mb: 1.5, color: theme.palette.text.primary }}
        >
          Add Tag
        </Typography>

        <TextField
          autoFocus
          fullWidth
          size="small"
          placeholder="Tag name"
          value={tagName}
          onChange={(e) => setTagName(e.target.value)}
          onKeyDown={handleKeyDown}
          data-testid="tag-name-input"
          sx={{ mb: 1.5 }}
        />

        <Typography
          variant="caption"
          sx={{
            mb: 0.75,
            display: "block",
            color: theme.palette.text.secondary,
          }}
        >
          Color
        </Typography>
        <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap", mb: 2 }}>
          {DEFAULT_TAG_COLORS.map((color) => (
            <Box
              key={color}
              data-testid={`color-option-${color.replace("#", "")}`}
              onClick={() => setSelectedColor(color)}
              sx={{
                width: 24,
                height: 24,
                borderRadius: "6px",
                backgroundColor: color,
                cursor: "pointer",
                border:
                  selectedColor === color
                    ? `2px solid ${theme.palette.text.primary}`
                    : "2px solid transparent",
                transition: "border-color 0.15s ease",
                "&:hover": {
                  transform: "scale(1.1)",
                },
              }}
            />
          ))}
        </Box>

        <Button
          fullWidth
          variant="contained"
          size="small"
          onClick={handleAddTag}
          disabled={!tagName.trim() || loading}
          data-testid="confirm-add-tag"
          sx={{ borderRadius: "8px" }}
        >
          {loading ? "Adding..." : "Add Tag"}
        </Button>
      </Popover>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
          severity={snackbar.severity}
          variant="filled"
          sx={{ width: "100%" }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
};

export default TagManager;
