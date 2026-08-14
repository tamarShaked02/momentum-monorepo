import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Box,
  Typography,
  MenuItem,
  Autocomplete,
  IconButton,
  useTheme,
} from "@mui/material";
import { Delete, Close } from "@mui/icons-material";
import DatePickerInput from "./DatePickerInput";

export interface AppointmentFormData {
  title: string;
  customerId: string | null;
  startTime: string;
  endTime: string;
  status: string;
  source: string;
  price: number | null;
  notes: string | null;
}

export interface AppointmentDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (data: AppointmentFormData) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
  initialData?: Partial<AppointmentFormData>;
  mode: "create" | "edit";
  customers?: Array<{ id: string; name: string }>;
}

interface FormErrors {
  title?: string;
  startTime?: string;
  endTime?: string;
}

const defaultFormData: AppointmentFormData = {
  title: "",
  customerId: null,
  startTime: "",
  endTime: "",
  status: "scheduled",
  source: "manual",
  price: null,
  notes: null,
};

const AppointmentDialog: React.FC<AppointmentDialogProps> = ({
  open,
  onClose,
  onSave,
  onDelete,
  initialData,
  mode,
  customers = [],
}) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const [form, setForm] = useState<AppointmentFormData>({ ...defaultFormData });
  const [errors, setErrors] = useState<FormErrors>({});
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (open) {
      setForm({
        ...defaultFormData,
        ...initialData,
      });
      setErrors({});
      setConfirmDelete(false);
    }
  }, [open, initialData]);

  const validate = (): boolean => {
    const newErrors: FormErrors = {};
    if (!form.title.trim()) {
      newErrors.title = "Title is required";
    }
    if (!form.startTime) {
      newErrors.startTime = "Start time is required";
    }
    if (!form.endTime) {
      newErrors.endTime = "End time is required";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      await onSave(form);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    if (onDelete) {
      setSaving(true);
      try {
        await onDelete("");
      } finally {
        setSaving(false);
      }
    }
  };

  const selectedCustomer =
    customers.find((c) => c.id === form.customerId) ?? null;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      slotProps={{
        paper: {
          sx: {
            background: isDark ? "rgba(26, 31, 58, 0.85)" : "#ffffff",
            backdropFilter: isDark ? "blur(20px)" : "none",
            border: isDark
              ? "1px solid rgba(255,255,255,0.1)"
              : "1px solid #e5e5ea",
            borderRadius: "24px",
            backgroundImage: "none",
            boxShadow: isDark ? undefined : "0 8px 32px rgba(0,0,0,0.12)",
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
          pb: 1,
        }}
      >
        <Typography variant="h6" component="span" sx={{ fontWeight: 600 }}>
          {mode === "create" ? "New Appointment" : "Edit Appointment"}
        </Typography>
        <IconButton
          onClick={onClose}
          size="small"
          sx={{ color: "text.secondary" }}
        >
          <Close />
        </IconButton>
      </DialogTitle>

      <DialogContent
        sx={{
          display: "flex",
          flexDirection: "column",
          gap: 2.5,
          pt: "12px !important",
        }}
      >
        <TextField
          label="Title"
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          fullWidth
          required
          error={!!errors.title}
          helperText={errors.title}
          placeholder="e.g. Haircut, Consultation"
        />

        <Autocomplete
          options={customers}
          getOptionLabel={(c) => c.name}
          value={selectedCustomer}
          onChange={(_e, value) =>
            setForm({ ...form, customerId: value?.id ?? null })
          }
          renderInput={(params) => (
            <TextField {...params} label="Customer (optional)" />
          )}
          isOptionEqualToValue={(option, value) => option.id === value.id}
        />

        <DatePickerInput
          label="Start Time *"
          value={form.startTime}
          onChange={(val) => setForm({ ...form, startTime: val })}
          type="datetime-local"
          required
          error={!!errors.startTime}
          helperText={errors.startTime}
        />

        <DatePickerInput
          label="End Time *"
          value={form.endTime}
          onChange={(val) => setForm({ ...form, endTime: val })}
          type="datetime-local"
          required
          error={!!errors.endTime}
          helperText={errors.endTime}
        />

        {mode === "edit" && (
          <TextField
            label="Status"
            select
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value })}
            fullWidth
          >
            <MenuItem value="scheduled">Scheduled</MenuItem>
            <MenuItem value="completed">Completed</MenuItem>
            <MenuItem value="cancelled">Cancelled</MenuItem>
            <MenuItem value="no_show">No Show</MenuItem>
          </TextField>
        )}

        <TextField
          label="Source"
          select
          value={form.source}
          onChange={(e) => setForm({ ...form, source: e.target.value })}
          fullWidth
        >
          <MenuItem value="manual">Manual</MenuItem>
          <MenuItem value="walk_in">Walk-in</MenuItem>
          <MenuItem value="telegram">Telegram</MenuItem>
        </TextField>

        <TextField
          label="Price"
          type="number"
          value={form.price ?? ""}
          onChange={(e) =>
            setForm({
              ...form,
              price: e.target.value ? Number(e.target.value) : null,
            })
          }
          fullWidth
          placeholder="Optional"
          slotProps={{
            input: { inputProps: { min: 0 } },
          }}
        />

        <TextField
          label="Notes"
          value={form.notes ?? ""}
          onChange={(e) => setForm({ ...form, notes: e.target.value || null })}
          multiline
          rows={3}
          fullWidth
          placeholder="Optional notes about this appointment"
        />
      </DialogContent>

      <DialogActions
        sx={{
          px: 3,
          pb: 3,
          pt: 1,
          justifyContent: mode === "edit" ? "space-between" : "flex-end",
        }}
      >
        {mode === "edit" && onDelete && (
          <Button
            onClick={handleDelete}
            color="error"
            startIcon={<Delete />}
            disabled={saving}
            sx={{
              borderRadius: "12px",
              ...(confirmDelete && {
                background: "rgba(255, 107, 107, 0.15)",
                border: "1px solid rgba(255, 107, 107, 0.4)",
              }),
            }}
          >
            {confirmDelete ? "Confirm Delete" : "Delete"}
          </Button>
        )}

        <Box sx={{ display: "flex", gap: 1 }}>
          <Button
            onClick={onClose}
            disabled={saving}
            sx={{ borderRadius: "12px" }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={saving}
            sx={{ borderRadius: "12px" }}
          >
            {saving
              ? "Saving..."
              : mode === "create"
                ? "Create"
                : "Save Changes"}
          </Button>
        </Box>
      </DialogActions>
    </Dialog>
  );
};

export default AppointmentDialog;
