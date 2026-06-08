import React, { useEffect, useState } from "react";
import {
  Box,
  Typography,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Fade,
  Chip,
  MenuItem,
  Autocomplete,
  IconButton,
} from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import type { GridColDef } from "@mui/x-data-grid";
import { Add, CalendarMonth, Edit, Delete } from "@mui/icons-material";
import api from "../api/client";
import { useSnackbar } from "../contexts/SnackbarContext";
import type { Appointment, Customer } from "../types";

const emptyForm = {
  title: "",
  startTime: "",
  endTime: "",
  notes: "",
  status: "scheduled",
  source: "manual",
  customerId: "",
  price: "",
};

const AppointmentsPage: React.FC = () => {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [selected, setSelected] = useState<string[]>([]);
  const [showPast, setShowPast] = useState(false);
  const { showConfirm } = useSnackbar();

  const fetchAppointments = () => {
    api
      .get("/appointments")
      .then((res) => {
        setAppointments(res.data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    fetchAppointments();
    api
      .get("/customers")
      .then((res) => setCustomers(res.data))
      .catch(() => {});
  }, []);

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...emptyForm });
    setDialogOpen(true);
  };

  const openEdit = (row: Appointment) => {
    setEditingId(row.id);
    setForm({
      title: row.title,
      startTime: row.startTime.slice(0, 16),
      endTime: row.endTime.slice(0, 16),
      notes: row.notes ?? "",
      status: row.status,
      source: row.source,
      customerId: row.customerId ?? "",
      price: row.price != null ? String(row.price) : "",
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.title || !form.startTime || !form.endTime) return;
    const payload = { ...form, price: form.price ? Number(form.price) : null };
    if (editingId) {
      await api.put(`/appointments/${editingId}`, payload);
    } else {
      await api.post("/appointments", payload);
    }
    setDialogOpen(false);
    setForm({ ...emptyForm });
    fetchAppointments();
  };

  const handleDelete = async (id: string) => {
    const confirmed = await showConfirm("Delete this appointment?");
    if (!confirmed) return;
    await api.delete(`/appointments/${id}`);
    fetchAppointments();
  };

  const handleBatchDelete = async () => {
    const confirmed = await showConfirm(
      `Delete ${selected.length} appointment(s)?`,
    );
    if (!confirmed) return;
    await Promise.all(selected.map((id) => api.delete(`/appointments/${id}`)));
    setSelected([]);
    fetchAppointments();
  };

  const handleStatusChange = async (id: string, status: string) => {
    await api.put(`/appointments/${id}`, { status });
    fetchAppointments();
  };

  const statusColors: Record<string, string> = {
    scheduled: "#4FC3F7",
    completed: "#66BB6A",
    cancelled: "#FF6B6B",
    no_show: "#FFB74D",
  };

  const columns: GridColDef[] = [
    { field: "title", headerName: "Service", flex: 1, minWidth: 120 },
    {
      field: "customerName",
      headerName: "Customer",
      flex: 1,
      minWidth: 120,
      valueGetter: (_value: any, row: any) => row.customer?.name || "Walk-in",
    },
    {
      field: "startTime",
      headerName: "Date & Time",
      flex: 1,
      minWidth: 160,
      valueFormatter: (value: any) => new Date(value).toLocaleString(),
    },
    {
      field: "status",
      headerName: "Status",
      width: 130,
      renderCell: (params: any) => (
        <Chip
          label={params.value}
          size="small"
          sx={{
            background: `${statusColors[params.value] || "#999"}22`,
            color: statusColors[params.value] || "#999",
            fontWeight: 600,
            textTransform: "capitalize",
          }}
        />
      ),
    },
    {
      field: "source",
      headerName: "Source",
      width: 110,
      renderCell: (params: any) => (
        <Chip
          label={params.value}
          size="small"
          variant="outlined"
          sx={{
            textTransform: "capitalize",
            borderColor: "rgba(255,255,255,0.15)",
          }}
        />
      ),
    },
    {
      field: "actions",
      headerName: "Actions",
      width: 220,
      sortable: false,
      renderCell: (params: any) => (
        <Box sx={{ display: "flex", gap: 0.5, alignItems: "center" }}>
          {params.row.status === "scheduled" && (
            <>
              <Button
                size="small"
                onClick={() => handleStatusChange(params.row.id, "completed")}
                sx={{ color: "#66BB6A", fontSize: "0.7rem" }}
              >
                Complete
              </Button>
              <Button
                size="small"
                onClick={() => handleStatusChange(params.row.id, "cancelled")}
                sx={{ color: "#FF6B6B", fontSize: "0.7rem" }}
              >
                Cancel
              </Button>
            </>
          )}
          <IconButton
            size="small"
            onClick={() => openEdit(params.row)}
            sx={{ color: "#4FC3F7" }}
          >
            <Edit fontSize="small" />
          </IconButton>
          <IconButton
            size="small"
            onClick={() => handleDelete(params.row.id)}
            sx={{ color: "#FF6B6B" }}
          >
            <Delete fontSize="small" />
          </IconButton>
        </Box>
      ),
    },
  ];

  const selectedCustomer =
    customers.find((c) => c.id === form.customerId) ?? null;

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const filteredAppointments = showPast
    ? appointments.filter((a) => new Date(a.startTime) < todayStart)
    : appointments.filter((a) => new Date(a.startTime) >= todayStart);

  return (
    <Fade in timeout={500}>
      <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            mb: 3,
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <CalendarMonth sx={{ color: "#4FC3F7", fontSize: 32 }} />
            <Typography variant="h4">Appointments</Typography>
          </Box>
          <Button variant="contained" startIcon={<Add />} onClick={openCreate}>
            New Appointment
          </Button>
        </Box>

        <Box sx={{ display: "flex", gap: 1, mb: 2 }}>
          <Button
            size="small"
            variant={showPast ? "outlined" : "contained"}
            onClick={() => setShowPast(false)}
          >
            Upcoming
          </Button>
          <Button
            size="small"
            variant={showPast ? "contained" : "outlined"}
            onClick={() => setShowPast(true)}
          >
            Past
          </Button>
          {selected.length > 0 && (
            <Button
              size="small"
              color="error"
              variant="outlined"
              onClick={handleBatchDelete}
            >
              Delete {selected.length} selected
            </Button>
          )}
        </Box>

        <Box
          sx={{
            background: "rgba(26,31,58,0.7)",
            borderRadius: 2,
            border: "1px solid rgba(255,255,255,0.08)",
            overflow: "hidden",
            flex: 1,
            minHeight: 0,
          }}
        >
          <DataGrid
            rows={filteredAppointments}
            columns={columns}
            loading={loading}
            checkboxSelection
            onRowSelectionModelChange={(model: any) =>
              setSelected(Array.from(model?.ids ?? []) as string[])
            }
            pageSizeOptions={[10]}
            initialState={{ pagination: { paginationModel: { pageSize: 10 } } }}
            sx={{
              border: "none",
              "& .MuiDataGrid-columnHeaders": {
                background: "rgba(255,255,255,0.03)",
              },
              "& .MuiDataGrid-row:hover": {
                background: "rgba(79,195,247,0.04)",
              },
              "& .MuiDataGrid-cell": { borderColor: "rgba(255,255,255,0.04)" },
            }}
          />
        </Box>

        <Dialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          maxWidth="sm"
          fullWidth
          slotProps={{
            paper: {
              sx: {
                background: "#1a1f3a",
                backgroundImage: "none",
                borderRadius: 4,
              },
            },
          }}
        >
          <DialogTitle>
            {editingId ? "Edit Appointment" : "New Appointment"}
          </DialogTitle>
          <DialogContent
            sx={{
              display: "flex",
              flexDirection: "column",
              gap: 2.5,
              pt: "16px !important",
            }}
          >
            <TextField
              label="Service / Title"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              fullWidth
            />
            <Autocomplete
              options={customers}
              getOptionLabel={(c) => c.name}
              value={selectedCustomer}
              onChange={(_e, value) =>
                setForm({ ...form, customerId: value?.id ?? "" })
              }
              renderInput={(params) => (
                <TextField {...params} label="Customer (optional)" />
              )}
              isOptionEqualToValue={(option, value) => option.id === value.id}
            />
            <Box>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ mb: 0.5, display: "block", pl: 0.5 }}
              >
                Start Time
              </Typography>
              <TextField
                type="datetime-local"
                value={form.startTime}
                onChange={(e) =>
                  setForm({ ...form, startTime: e.target.value })
                }
                fullWidth
              />
            </Box>
            <Box>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ mb: 0.5, display: "block", pl: 0.5 }}
              >
                End Time
              </Typography>
              <TextField
                type="datetime-local"
                value={form.endTime}
                onChange={(e) => setForm({ ...form, endTime: e.target.value })}
                fullWidth
              />
            </Box>
            <TextField
              label="Source"
              select
              value={form.source}
              onChange={(e) => setForm({ ...form, source: e.target.value })}
              fullWidth
            >
              <MenuItem value="manual">Manual</MenuItem>
              <MenuItem value="walk_in">Walk-in</MenuItem>
            </TextField>
            {editingId && (
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
              label="Price (₪)"
              type="number"
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })}
              fullWidth
              placeholder="Optional"
            />
            <TextField
              label="Notes"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              multiline
              rows={2}
              fullWidth
            />
          </DialogContent>
          <DialogActions sx={{ p: 3 }}>
            <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button variant="contained" onClick={handleSave}>
              {editingId ? "Save Changes" : "Create"}
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </Fade>
  );
};

export default AppointmentsPage;
