import React, { useState, useEffect, useCallback } from "react";
import {
  Box,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  IconButton,
  Typography,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Chip,
  Alert,
  Snackbar,
  CircularProgress,
  Divider,
  useTheme,
} from "@mui/material";
import { Close, Add, Delete, Edit } from "@mui/icons-material";
import type {
  CustomField,
  CustomFieldType,
  CustomFieldCreateData,
  CustomFieldUpdateData,
} from "../../types/crm";
import { CUSTOM_FIELD_TYPES } from "../../types/crm";
import {
  getCustomFields,
  createCustomField,
  updateCustomField,
  deleteCustomField,
} from "../../api/crm";

export interface CustomFieldEditorProps {
  open: boolean;
  onClose: () => void;
}

type ViewMode = "list" | "create" | "edit";

const FIELD_TYPE_LABELS: Record<CustomFieldType, string> = {
  text: "Text",
  number: "Number",
  date: "Date",
  dropdown: "Dropdown",
};

const MAX_DROPDOWN_OPTIONS = 50;

const CustomFieldEditor: React.FC<CustomFieldEditorProps> = ({
  open,
  onClose,
}) => {
  const theme = useTheme();

  const [fields, setFields] = useState<CustomField[]>([]);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null);

  // Field builder state
  const [fieldName, setFieldName] = useState("");
  const [fieldType, setFieldType] = useState<CustomFieldType>("text");
  const [dropdownOptions, setDropdownOptions] = useState<string[]>([]);
  const [newOption, setNewOption] = useState("");

  // Delete confirmation
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Snackbar
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: "success" | "error";
  }>({ open: false, message: "", severity: "success" });

  const fetchFields = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getCustomFields();
      setFields(data);
    } catch {
      setSnackbar({
        open: true,
        message: "Failed to load custom fields.",
        severity: "error",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      fetchFields();
      setViewMode("list");
      setDeleteConfirmId(null);
    }
  }, [open, fetchFields]);

  const resetBuilder = () => {
    setFieldName("");
    setFieldType("text");
    setDropdownOptions([]);
    setNewOption("");
    setEditingFieldId(null);
  };

  const handleCreate = () => {
    resetBuilder();
    setViewMode("create");
  };

  const handleEdit = (field: CustomField) => {
    setFieldName(field.name);
    setFieldType(field.fieldType);
    setDropdownOptions(field.options ?? []);
    setNewOption("");
    setEditingFieldId(field.id);
    setViewMode("edit");
  };

  const handleSave = async () => {
    const trimmedName = fieldName.trim();
    if (!trimmedName) {
      setSnackbar({
        open: true,
        message: "Field name is required.",
        severity: "error",
      });
      return;
    }

    if (fieldType === "dropdown" && dropdownOptions.length === 0) {
      setSnackbar({
        open: true,
        message: "Dropdown fields require at least one option.",
        severity: "error",
      });
      return;
    }

    try {
      if (viewMode === "edit" && editingFieldId) {
        const updateData: CustomFieldUpdateData = {
          name: trimmedName,
          fieldType,
          options: fieldType === "dropdown" ? dropdownOptions : [],
        };
        await updateCustomField(editingFieldId, updateData);
        setSnackbar({
          open: true,
          message: "Custom field updated successfully.",
          severity: "success",
        });
      } else {
        const createData: CustomFieldCreateData = {
          name: trimmedName,
          fieldType,
          options: fieldType === "dropdown" ? dropdownOptions : [],
        };
        await createCustomField(createData);
        setSnackbar({
          open: true,
          message: "Custom field created successfully.",
          severity: "success",
        });
      }
      setViewMode("list");
      resetBuilder();
      fetchFields();
    } catch {
      setSnackbar({
        open: true,
        message: "Failed to save custom field. Please try again.",
        severity: "error",
      });
    }
  };

  const handleDelete = async (fieldId: string) => {
    try {
      await deleteCustomField(fieldId);
      setFields((prev) => prev.filter((f) => f.id !== fieldId));
      setDeleteConfirmId(null);
      setSnackbar({
        open: true,
        message: "Custom field deleted.",
        severity: "success",
      });
    } catch {
      setSnackbar({
        open: true,
        message: "Failed to delete custom field.",
        severity: "error",
      });
    }
  };

  const handleAddOption = () => {
    const trimmed = newOption.trim();
    if (!trimmed) return;
    if (dropdownOptions.length >= MAX_DROPDOWN_OPTIONS) {
      setSnackbar({
        open: true,
        message: `Maximum ${MAX_DROPDOWN_OPTIONS} options allowed.`,
        severity: "error",
      });
      return;
    }
    if (
      dropdownOptions.some((opt) => opt.toLowerCase() === trimmed.toLowerCase())
    ) {
      setSnackbar({
        open: true,
        message: "This option already exists.",
        severity: "error",
      });
      return;
    }
    setDropdownOptions([...dropdownOptions, trimmed]);
    setNewOption("");
  };

  const handleRemoveOption = (index: number) => {
    setDropdownOptions(dropdownOptions.filter((_, i) => i !== index));
  };

  const handleOptionKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddOption();
    }
  };

  const renderFieldList = () => (
    <Box>
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          mb: 2,
        }}
      >
        <Typography
          variant="subtitle1"
          sx={{ color: theme.palette.text.primary }}
        >
          Custom Fields ({fields.length})
        </Typography>
        <Button
          variant="contained"
          size="small"
          startIcon={<Add />}
          onClick={handleCreate}
          data-testid="create-field-button"
          sx={{ borderRadius: "8px" }}
        >
          New Field
        </Button>
      </Box>

      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
          <CircularProgress size={28} />
        </Box>
      ) : fields.length === 0 ? (
        <Typography
          variant="body2"
          sx={{
            color: theme.palette.text.secondary,
            textAlign: "center",
            py: 4,
          }}
        >
          No custom fields yet. Create one to extend contact profiles.
        </Typography>
      ) : (
        <List disablePadding>
          {fields.map((field) => (
            <React.Fragment key={field.id}>
              <ListItem
                sx={{
                  borderRadius: "8px",
                  mb: 0.5,
                  backgroundColor: theme.palette.background.default,
                }}
              >
                <ListItemText
                  primary={field.name}
                  secondary={
                    <Box
                      component="span"
                      sx={{ display: "flex", alignItems: "center", gap: 1 }}
                    >
                      <Chip
                        label={FIELD_TYPE_LABELS[field.fieldType]}
                        size="small"
                        sx={{
                          fontSize: "0.65rem",
                          height: 20,
                          backgroundColor: theme.palette.action.hover,
                          color: theme.palette.text.secondary,
                        }}
                      />
                      {field.fieldType === "dropdown" &&
                        field.options.length > 0 && (
                          <Typography
                            component="span"
                            variant="caption"
                            sx={{ color: theme.palette.text.secondary }}
                          >
                            {field.options.length} option
                            {field.options.length !== 1 ? "s" : ""}
                          </Typography>
                        )}
                    </Box>
                  }
                  slotProps={{
                    primary: {
                      sx: {
                        color: theme.palette.text.primary,
                        fontWeight: 500,
                      },
                    },
                  }}
                />
                <ListItemSecondaryAction
                  sx={{ display: "flex", alignItems: "center", gap: 0.5 }}
                >
                  <IconButton
                    size="small"
                    onClick={() => handleEdit(field)}
                    data-testid={`edit-field-${field.id}`}
                    sx={{ color: theme.palette.text.secondary }}
                  >
                    <Edit fontSize="small" />
                  </IconButton>
                  {deleteConfirmId === field.id ? (
                    <Box
                      sx={{ display: "flex", alignItems: "center", gap: 0.5 }}
                    >
                      <Button
                        size="small"
                        color="error"
                        variant="contained"
                        onClick={() => handleDelete(field.id)}
                        data-testid={`confirm-delete-field-${field.id}`}
                        sx={{
                          minWidth: "auto",
                          px: 1,
                          fontSize: "0.7rem",
                          borderRadius: "6px",
                        }}
                      >
                        Delete
                      </Button>
                      <Button
                        size="small"
                        onClick={() => setDeleteConfirmId(null)}
                        data-testid={`cancel-delete-field-${field.id}`}
                        sx={{
                          minWidth: "auto",
                          px: 1,
                          fontSize: "0.7rem",
                          color: theme.palette.text.secondary,
                        }}
                      >
                        Cancel
                      </Button>
                    </Box>
                  ) : (
                    <IconButton
                      size="small"
                      onClick={() => setDeleteConfirmId(field.id)}
                      data-testid={`delete-field-${field.id}`}
                      sx={{ color: theme.palette.error.main }}
                    >
                      <Delete fontSize="small" />
                    </IconButton>
                  )}
                </ListItemSecondaryAction>
              </ListItem>
              <Divider sx={{ opacity: 0.3 }} />
            </React.Fragment>
          ))}
        </List>
      )}
    </Box>
  );

  const renderFieldBuilder = () => (
    <Box>
      <Typography
        variant="subtitle1"
        sx={{ color: theme.palette.text.primary, mb: 2 }}
      >
        {viewMode === "edit" ? "Edit Custom Field" : "Create Custom Field"}
      </Typography>

      <TextField
        fullWidth
        size="small"
        label="Field Name"
        value={fieldName}
        onChange={(e) => setFieldName(e.target.value)}
        data-testid="field-name-input"
        sx={{ mb: 2 }}
        slotProps={{
          htmlInput: { maxLength: 100 },
        }}
      />

      <FormControl fullWidth size="small" sx={{ mb: 2 }}>
        <InputLabel>Field Type</InputLabel>
        <Select
          label="Field Type"
          value={fieldType}
          onChange={(e) => {
            setFieldType(e.target.value as CustomFieldType);
            if (e.target.value !== "dropdown") {
              setDropdownOptions([]);
            }
          }}
          data-testid="field-type-select"
        >
          {CUSTOM_FIELD_TYPES.map((ft) => (
            <MenuItem key={ft} value={ft}>
              {FIELD_TYPE_LABELS[ft]}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      {fieldType === "dropdown" && (
        <Box
          sx={{
            p: 2,
            borderRadius: "8px",
            backgroundColor: theme.palette.background.default,
            border: `1px solid ${theme.palette.divider}`,
          }}
        >
          <Typography
            variant="subtitle2"
            sx={{ color: theme.palette.text.primary, mb: 1.5 }}
          >
            Dropdown Options ({dropdownOptions.length}/{MAX_DROPDOWN_OPTIONS})
          </Typography>

          <Box sx={{ display: "flex", gap: 1, mb: 1.5 }}>
            <TextField
              size="small"
              placeholder="Add option..."
              value={newOption}
              onChange={(e) => setNewOption(e.target.value)}
              onKeyDown={handleOptionKeyDown}
              data-testid="option-input"
              sx={{ flex: 1 }}
              slotProps={{
                htmlInput: { maxLength: 200 },
              }}
            />
            <Button
              variant="outlined"
              size="small"
              onClick={handleAddOption}
              disabled={
                !newOption.trim() ||
                dropdownOptions.length >= MAX_DROPDOWN_OPTIONS
              }
              data-testid="add-option-button"
              sx={{ borderRadius: "8px", minWidth: "auto", px: 2 }}
            >
              <Add fontSize="small" />
            </Button>
          </Box>

          {dropdownOptions.length === 0 ? (
            <Typography
              variant="caption"
              sx={{ color: theme.palette.text.secondary }}
            >
              No options added yet. Add at least one option.
            </Typography>
          ) : (
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75 }}>
              {dropdownOptions.map((option, index) => (
                <Chip
                  key={index}
                  label={option}
                  size="small"
                  onDelete={() => handleRemoveOption(index)}
                  deleteIcon={
                    <Close
                      sx={{ fontSize: 14 }}
                      data-testid={`remove-option-${index}`}
                    />
                  }
                  data-testid={`option-chip-${index}`}
                  sx={{
                    backgroundColor: `${theme.palette.primary.main}18`,
                    color: theme.palette.text.primary,
                    border: `1px solid ${theme.palette.primary.main}44`,
                    "& .MuiChip-deleteIcon": {
                      color: theme.palette.text.secondary,
                      "&:hover": {
                        color: theme.palette.error.main,
                      },
                    },
                  }}
                />
              ))}
            </Box>
          )}
        </Box>
      )}
    </Box>
  );

  return (
    <>
      <Dialog
        open={open}
        onClose={onClose}
        maxWidth="sm"
        fullWidth
        slotProps={{
          paper: {
            sx: {
              backgroundColor: theme.palette.background.paper,
              borderRadius: "12px",
              minHeight: 400,
            },
          },
        }}
      >
        <DialogTitle
          component="div"
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            color: theme.palette.text.primary,
          }}
        >
          <Typography variant="h6" component="span">
            Custom Fields
          </Typography>
          <IconButton
            size="small"
            onClick={onClose}
            sx={{ color: theme.palette.text.secondary }}
            data-testid="close-custom-fields-dialog"
          >
            <Close />
          </IconButton>
        </DialogTitle>

        <DialogContent dividers sx={{ pt: 2 }}>
          {viewMode === "list" ? renderFieldList() : renderFieldBuilder()}
        </DialogContent>

        {viewMode !== "list" && (
          <DialogActions sx={{ px: 3, py: 2 }}>
            <Button
              onClick={() => {
                setViewMode("list");
                resetBuilder();
              }}
              sx={{ color: theme.palette.text.secondary }}
              data-testid="cancel-field-button"
            >
              Cancel
            </Button>
            <Button
              variant="contained"
              onClick={handleSave}
              data-testid="save-field-button"
              sx={{ borderRadius: "8px" }}
            >
              {viewMode === "edit" ? "Update Field" : "Create Field"}
            </Button>
          </DialogActions>
        )}
      </Dialog>

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
    </>
  );
};

export default CustomFieldEditor;
