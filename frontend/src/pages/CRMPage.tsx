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
  Drawer,
  IconButton,
} from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import type { GridColDef } from "@mui/x-data-grid";
import { Add, People, Close, History, Edit, Delete } from "@mui/icons-material";
import api from "../api/client";
import { useSnackbar } from "../contexts/SnackbarContext";
import type { Customer, Appointment } from "../types";

const emptyForm = { name: "", email: "", phone: "", notes: "" };

const CRMPage: React.FC = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(
    null,
  );
  const [history, setHistory] = useState<Appointment[]>([]);
  const [form, setForm] = useState({ ...emptyForm });
  const [searchQuery, setSearchQuery] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const { showConfirm } = useSnackbar();

  const fetchCustomers = () => {
    api
      .get("/customers")
      .then((res) => {
        setCustomers(res.data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    fetchCustomers();
  }, []);

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...emptyForm });
    setDialogOpen(true);
  };

  const openEdit = (customer: Customer) => {
    setEditingId(customer.id);
    setForm({
      name: customer.name,
      email: customer.email ?? "",
      phone: customer.phone ?? "",
      notes: customer.notes ?? "",
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name) return;
    if (editingId) {
      await api.put(`/customers/${editingId}`, form);
      // update drawer if open
      setSelectedCustomer((prev) =>
        prev?.id === editingId ? { ...prev, ...form } : prev,
      );
    } else {
      await api.post("/customers", form);
    }
    setDialogOpen(false);
    setForm({ ...emptyForm });
    fetchCustomers();
  };

  const handleDelete = async (id: string) => {
    const confirmed = await showConfirm(
      "Delete this customer? This cannot be undone.",
    );
    if (!confirmed) return;
    await api.delete(`/customers/${id}`);
    if (selectedCustomer?.id === id) setDrawerOpen(false);
    fetchCustomers();
  };

  const handleBatchDelete = async () => {
    const confirmed = await showConfirm(
      `Delete ${selected.length} customer(s)?`,
    );
    if (!confirmed) return;
    await Promise.all(selected.map((id) => api.delete(`/customers/${id}`)));
    setSelected([]);
    fetchCustomers();
  };

  const openProfile = async (customer: Customer) => {
    setSelectedCustomer(customer);
    setDrawerOpen(true);
    try {
      const res = await api.get(`/customers/${customer.id}/history`);
      setHistory(res.data.appointments || []);
    } catch {
      setHistory([]);
    }
  };

  const columns: GridColDef[] = [
    { field: "name", headerName: "Name", flex: 1, minWidth: 140 },
    { field: "email", headerName: "Email", flex: 1, minWidth: 160 },
    { field: "phone", headerName: "Phone", flex: 0.8, minWidth: 120 },
    {
      field: "appointments",
      headerName: "Visits",
      width: 90,
      valueGetter: (_v: any, row: any) => row._count?.appointments ?? 0,
    },
    {
      field: "createdAt",
      headerName: "Added",
      width: 120,
      valueFormatter: (value: any) => new Date(value).toLocaleDateString(),
    },
    {
      field: "actions",
      headerName: "",
      width: 150,
      sortable: false,
      renderCell: (params: any) => (
        <Box sx={{ display: "flex", gap: 0.5, alignItems: "center" }}>
          <Button
            size="small"
            onClick={() => openProfile(params.row)}
            sx={{ color: "#4FC3F7" }}
          >
            View
          </Button>
          <IconButton
            size="small"
            onClick={() => openEdit(params.row)}
            sx={{ color: "#FFB74D" }}
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

  const filteredCustomers = customers.filter((c) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      (c.email && c.email.toLowerCase().includes(q)) ||
      (c.phone && c.phone.toLowerCase().includes(q))
    );
  });

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
            <People sx={{ color: "#BA68C8", fontSize: 32 }} />
            <Typography variant="h4">Customers</Typography>
          </Box>
          <Button variant="contained" startIcon={<Add />} onClick={openCreate}>
            Add Customer
          </Button>
        </Box>

        <TextField
          placeholder="Search by name, email or phone..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          size="small"
          sx={{ mb: 2, maxWidth: 400 }}
        />
        {selected.length > 0 && (
          <Button
            size="small"
            color="error"
            variant="outlined"
            onClick={handleBatchDelete}
            sx={{ mb: 2, ml: 2 }}
          >
            Delete {selected.length} selected
          </Button>
        )}

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
            rows={filteredCustomers}
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

        {/* Create / Edit Dialog */}
        <Dialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          maxWidth="sm"
          fullWidth
          slotProps={{
            paper: { sx: { background: "#1a1f3a", borderRadius: 4 } },
          }}
        >
          <DialogTitle>
            {editingId ? "Edit Customer" : "Add Customer"}
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
              label="Name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              fullWidth
              required
            />
            <TextField
              label="Email"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              fullWidth
            />
            <TextField
              label="Phone"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              fullWidth
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
              {editingId ? "Save Changes" : "Save"}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Profile Drawer */}
        <Drawer
          anchor="right"
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          slotProps={{
            paper: {
              sx: {
                width: { xs: "100%", sm: 420 },
                background: "#0d1130",
                p: 0,
              },
            },
          }}
        >
          {selectedCustomer && (
            <Box
              sx={{ display: "flex", flexDirection: "column", height: "100%" }}
            >
              {/* Header */}
              <Box
                sx={{
                  px: 3,
                  pt: 3,
                  pb: 2.5,
                  background: "rgba(186,104,200,0.08)",
                  borderBottom: "1px solid rgba(255,255,255,0.06)",
                }}
              >
                <Box
                  sx={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                  }}
                >
                  <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
                    <Box
                      sx={{
                        width: 48,
                        height: 48,
                        borderRadius: "50%",
                        background: "linear-gradient(135deg, #BA68C8, #7B1FA2)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 20,
                        fontWeight: 700,
                        color: "#fff",
                      }}
                    >
                      {selectedCustomer.name[0].toUpperCase()}
                    </Box>
                    <Box>
                      <Typography
                        variant="h6"
                        fontWeight={700}
                        sx={{ lineHeight: 1.2 }}
                      >
                        {selectedCustomer.name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Customer since{" "}
                        {new Date(
                          selectedCustomer.createdAt,
                        ).toLocaleDateString()}
                      </Typography>
                    </Box>
                  </Box>
                  <Box sx={{ display: "flex", gap: 0.5 }}>
                    <IconButton
                      size="small"
                      onClick={() => {
                        setDrawerOpen(false);
                        openEdit(selectedCustomer);
                      }}
                      sx={{ color: "#FFB74D" }}
                    >
                      <Edit fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => handleDelete(selectedCustomer.id)}
                      sx={{ color: "#FF6B6B" }}
                    >
                      <Delete fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => setDrawerOpen(false)}
                      sx={{ ml: 0.5 }}
                    >
                      <Close />
                    </IconButton>
                  </Box>
                </Box>
              </Box>

              {/* Contact Info */}
              <Box
                sx={{
                  px: 3,
                  py: 2.5,
                  borderBottom: "1px solid rgba(255,255,255,0.06)",
                }}
              >
                <Typography
                  variant="overline"
                  color="text.secondary"
                  sx={{ letterSpacing: 1.5, fontSize: "0.7rem" }}
                >
                  Contact
                </Typography>
                <Box
                  sx={{
                    mt: 1.5,
                    display: "flex",
                    flexDirection: "column",
                    gap: 1.5,
                  }}
                >
                  {selectedCustomer.email && (
                    <Box
                      sx={{ display: "flex", alignItems: "center", gap: 1.5 }}
                    >
                      <Box
                        sx={{
                          width: 32,
                          height: 32,
                          borderRadius: 1.5,
                          background: "rgba(79,195,247,0.1)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 16,
                        }}
                      >
                        📧
                      </Box>
                      <Typography variant="body2">
                        {selectedCustomer.email}
                      </Typography>
                    </Box>
                  )}
                  {selectedCustomer.phone && (
                    <Box
                      sx={{ display: "flex", alignItems: "center", gap: 1.5 }}
                    >
                      <Box
                        sx={{
                          width: 32,
                          height: 32,
                          borderRadius: 1.5,
                          background: "rgba(102,187,106,0.1)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 16,
                        }}
                      >
                        📱
                      </Box>
                      <Typography variant="body2">
                        {selectedCustomer.phone}
                      </Typography>
                    </Box>
                  )}
                </Box>
              </Box>

              {/* Notes */}
              {selectedCustomer.notes && (
                <Box
                  sx={{
                    px: 3,
                    py: 2.5,
                    borderBottom: "1px solid rgba(255,255,255,0.06)",
                  }}
                >
                  <Typography
                    variant="overline"
                    color="text.secondary"
                    sx={{ letterSpacing: 1.5, fontSize: "0.7rem" }}
                  >
                    Notes
                  </Typography>
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{
                      mt: 1.5,
                      p: 2,
                      background: "rgba(255,255,255,0.03)",
                      borderRadius: 2,
                      lineHeight: 1.7,
                    }}
                  >
                    {selectedCustomer.notes}
                  </Typography>
                </Box>
              )}

              {/* Appointment History */}
              <Box sx={{ px: 3, py: 2.5, flex: 1, overflow: "auto" }}>
                <Box
                  sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}
                >
                  <History sx={{ color: "#4FC3F7", fontSize: 18 }} />
                  <Typography
                    variant="overline"
                    color="text.secondary"
                    sx={{ letterSpacing: 1.5, fontSize: "0.7rem" }}
                  >
                    Appointment History
                  </Typography>
                  <Chip
                    label={history.length}
                    size="small"
                    sx={{
                      ml: "auto",
                      background: "rgba(79,195,247,0.12)",
                      color: "#4FC3F7",
                      fontWeight: 700,
                      height: 20,
                      fontSize: "0.7rem",
                    }}
                  />
                </Box>
                {history.length > 0 ? (
                  <Box
                    sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}
                  >
                    {history.map((apt) => {
                      const statusColors: Record<string, string> = {
                        scheduled: "#4FC3F7",
                        completed: "#66BB6A",
                        cancelled: "#FF6B6B",
                        no_show: "#FFB74D",
                      };
                      const color = statusColors[apt.status] ?? "#999";
                      return (
                        <Box
                          key={apt.id}
                          sx={{
                            p: 2,
                            background: "rgba(255,255,255,0.03)",
                            borderRadius: 2,
                            border: "1px solid rgba(255,255,255,0.05)",
                          }}
                        >
                          <Box
                            sx={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              mb: 0.5,
                            }}
                          >
                            <Typography variant="body2" fontWeight={600}>
                              {apt.title}
                            </Typography>
                            <Chip
                              label={apt.status}
                              size="small"
                              sx={{
                                textTransform: "capitalize",
                                fontSize: "0.65rem",
                                height: 20,
                                background: `${color}22`,
                                color,
                              }}
                            />
                          </Box>
                          <Typography variant="caption" color="text.secondary">
                            {new Date(apt.startTime).toLocaleString()}
                          </Typography>
                          {apt.notes && (
                            <Typography
                              variant="caption"
                              color="text.secondary"
                              sx={{
                                display: "block",
                                mt: 1,
                                p: 1,
                                background: "rgba(255,255,255,0.03)",
                                borderRadius: 1.5,
                                fontStyle: "italic",
                                lineHeight: 1.6,
                              }}
                            >
                              📝 {apt.notes}
                            </Typography>
                          )}
                        </Box>
                      );
                    })}
                  </Box>
                ) : (
                  <Box sx={{ textAlign: "center", py: 4 }}>
                    <Typography variant="body2" color="text.secondary">
                      No appointments yet.
                    </Typography>
                  </Box>
                )}
              </Box>
            </Box>
          )}
        </Drawer>
      </Box>
    </Fade>
  );
};

export default CRMPage;
