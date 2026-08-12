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
  IconButton,
} from "@mui/material";
import { DataGrid } from "@mui/x-data-grid";
import type { GridColDef } from "@mui/x-data-grid";
import { Add, Inventory2, Edit, Delete } from "@mui/icons-material";
import api from "../api/client";
import { useSnackbar } from "../contexts/SnackbarContext";
import type { InventoryItem } from "../types";

const emptyForm = {
  name: "",
  sku: "",
  quantity: 0,
  lowThreshold: 5,
  price: 0,
  category: "",
};

const InventoryPage: React.FC = () => {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...emptyForm });
  const [selected, setSelected] = useState<string[]>([]);
  const { showConfirm } = useSnackbar();

  const fetchItems = () => {
    api
      .get("/inventory")
      .then((res) => {
        setItems(res.data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };
  useEffect(() => {
    fetchItems();
  }, []);

  const handleSave = async () => {
    if (!form.name) return;
    if (editingId) {
      await api.put(`/inventory/${editingId}`, form);
    } else {
      await api.post("/inventory", form);
    }
    setDialogOpen(false);
    setEditingId(null);
    setForm({ ...emptyForm });
    fetchItems();
  };

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...emptyForm });
    setDialogOpen(true);
  };

  const openEdit = (item: InventoryItem) => {
    setEditingId(item.id);
    setForm({
      name: item.name,
      sku: item.sku ?? "",
      quantity: item.quantity,
      lowThreshold: item.lowThreshold,
      price: item.price ? Number(item.price) : 0,
      category: item.category ?? "",
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    const confirmed = await showConfirm("Delete this inventory item?");
    if (!confirmed) return;
    await api.delete(`/inventory/${id}`);
    fetchItems();
  };

  const handleBatchDelete = async () => {
    const confirmed = await showConfirm(`Delete ${selected.length} item(s)?`);
    if (!confirmed) return;
    await Promise.all(selected.map((id) => api.delete(`/inventory/${id}`)));
    setSelected([]);
    fetchItems();
  };

  const handleQuantityChange = async (id: string, quantity: number) => {
    await api.put(`/inventory/${id}`, { quantity });
    fetchItems();
  };

  const columns: GridColDef[] = [
    {
      field: "name",
      headerName: "Product",
      flex: 1,
      minWidth: 140,
      renderCell: (params: any) => (
        <Box sx={{ display: "flex", alignItems: "center", height: "100%" }}>
          <Typography variant="body2" sx={{ fontWeight: 600, color: "text.primary" }}>
            {params.value}
          </Typography>
        </Box>
      ),
    },
    {
      field: "sku",
      headerName: "SKU",
      width: 100,
      renderCell: (params: any) => (
        <Box sx={{ display: "flex", alignItems: "center", height: "100%" }}>
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            {params.value || "—"}
          </Typography>
        </Box>
      ),
    },
    {
      field: "category",
      headerName: "Category",
      width: 120,
      renderCell: (params: any) => (
        <Box sx={{ display: "flex", alignItems: "center", height: "100%" }}>
          <Typography variant="body2">
            {params.value || "—"}
          </Typography>
        </Box>
      ),
    },
    {
      field: "quantity",
      headerName: "Stock",
      width: 100,
      renderCell: (params: any) => {
        const isLow = params.row.quantity <= params.row.lowThreshold;
        return (
          <Box sx={{ display: "flex", alignItems: "center", height: "100%" }}>
            <Chip
              label={params.value}
              size="small"
              sx={{
                fontWeight: 700,
                background: isLow
                  ? "rgba(255,107,107,0.2)"
                  : "rgba(102,187,106,0.15)",
                color: isLow ? "#FF6B6B" : "#66BB6A",
              }}
            />
          </Box>
        );
      },
    },
    {
      field: "lowThreshold",
      headerName: "Min",
      width: 80,
      renderCell: (params: any) => (
        <Box sx={{ display: "flex", alignItems: "center", height: "100%" }}>
          <Typography variant="body2" sx={{ color: "text.secondary" }}>
            {params.value}
          </Typography>
        </Box>
      ),
    },
    {
      field: "price",
      headerName: "Price",
      width: 90,
      renderCell: (params: any) => (
        <Box sx={{ display: "flex", alignItems: "center", height: "100%" }}>
          <Typography variant="body2">
            {params.value ? `$${Number(params.value).toFixed(2)}` : "-"}
          </Typography>
        </Box>
      ),
    },
    {
      field: "actions",
      headerName: "Quick Stock",
      width: 160,
      sortable: false,
      renderCell: (params: any) => (
        <Box sx={{ display: "flex", gap: 0.5, alignItems: "center", height: "100%" }}>
          <Button
            size="small"
            variant="outlined"
            sx={{ minWidth: 32, px: 0, borderColor: "rgba(255,255,255,0.15)" }}
            onClick={(e) => {
              e.stopPropagation();
              handleQuantityChange(
                params.row.id,
                Math.max(0, params.row.quantity - 1),
              );
            }}
          >
            −
          </Button>
          <Typography
            variant="body2"
            sx={{ minWidth: 24, textAlign: "center" }}
          >
            {params.row.quantity}
          </Typography>
          <Button
            size="small"
            variant="outlined"
            sx={{ minWidth: 32, px: 0, borderColor: "rgba(255,255,255,0.15)" }}
            onClick={(e) => {
              e.stopPropagation();
              handleQuantityChange(params.row.id, params.row.quantity + 1);
            }}
          >
            +
          </Button>
        </Box>
      ),
    },
    {
      field: "manage",
      headerName: "Actions",
      width: 100,
      sortable: false,
      renderCell: (params: any) => (
        <Box sx={{ display: "flex", gap: 0.5, alignItems: "center", height: "100%" }}>
          <IconButton
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              openEdit(params.row);
            }}
            sx={{ color: "#4FC3F7" }}
          >
            <Edit fontSize="small" />
          </IconButton>
          <IconButton
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              handleDelete(params.row.id);
            }}
            sx={{ color: "#FF6B6B" }}
          >
            <Delete fontSize="small" />
          </IconButton>
        </Box>
      ),
    },
  ];

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
            <Inventory2 sx={{ color: "#FFB74D", fontSize: 32 }} />
            <Typography variant="h4">Inventory</Typography>
          </Box>
          <Button variant="contained" startIcon={<Add />} onClick={openCreate}>
            Add Item
          </Button>
        </Box>
        {selected.length > 0 && (
          <Button
            size="small"
            color="error"
            variant="outlined"
            onClick={handleBatchDelete}
            sx={{ mb: 2 }}
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
            rows={items}
            columns={columns}
            loading={loading}
            checkboxSelection
            disableRowSelectionOnClick
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
            paper: { sx: { background: "#1a1f3a", borderRadius: 4 } },
          }}
        >
          <DialogTitle>
            {editingId ? "Edit Inventory Item" : "Add Inventory Item"}
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
              label="Product Name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              fullWidth
              required
            />
            <TextField
              label="SKU"
              value={form.sku}
              onChange={(e) => setForm({ ...form, sku: e.target.value })}
              fullWidth
            />
            <Box sx={{ display: "flex", gap: 2 }}>
              <TextField
                label="Quantity"
                type="number"
                value={form.quantity}
                onChange={(e) =>
                  setForm({ ...form, quantity: +e.target.value })
                }
                fullWidth
              />
              <TextField
                label="Low Threshold"
                type="number"
                value={form.lowThreshold}
                onChange={(e) =>
                  setForm({ ...form, lowThreshold: +e.target.value })
                }
                fullWidth
              />
            </Box>
            <Box sx={{ display: "flex", gap: 2 }}>
              <TextField
                label="Price"
                type="number"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: +e.target.value })}
                fullWidth
              />
              <TextField
                label="Category"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                fullWidth
              />
            </Box>
          </DialogContent>
          <DialogActions sx={{ p: 3 }}>
            <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button variant="contained" onClick={handleSave}>
              {editingId ? "Save Changes" : "Add Item"}
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </Fade>
  );
};

export default InventoryPage;
