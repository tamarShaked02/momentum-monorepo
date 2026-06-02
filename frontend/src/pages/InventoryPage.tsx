import React, { useEffect, useState } from 'react';
import { Box, Typography, Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Fade, Chip } from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import type { GridColDef } from '@mui/x-data-grid';
import { Add, Inventory2 } from '@mui/icons-material';
import api from '../api/client';
import type { InventoryItem } from '../types';

const InventoryPage: React.FC = () => {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ name: '', sku: '', quantity: 0, lowThreshold: 5, price: 0, category: '' });

  const fetchItems = () => { api.get('/inventory').then(res => { setItems(res.data); setLoading(false); }).catch(() => setLoading(false)); };
  useEffect(() => { fetchItems(); }, []);

  const handleCreate = async () => {
    if (!form.name) return;
    await api.post('/inventory', form);
    setDialogOpen(false);
    setForm({ name: '', sku: '', quantity: 0, lowThreshold: 5, price: 0, category: '' });
    fetchItems();
  };

  const handleQuantityChange = async (id: string, quantity: number) => {
    await api.put(`/inventory/${id}`, { quantity });
    fetchItems();
  };

  const columns: GridColDef[] = [
    { field: 'name', headerName: 'Product', flex: 1, minWidth: 140 },
    { field: 'sku', headerName: 'SKU', width: 100 },
    { field: 'category', headerName: 'Category', width: 120 },
    { field: 'quantity', headerName: 'Stock', width: 100,
      renderCell: (params: any) => {
        const isLow = params.row.quantity <= params.row.lowThreshold;
        return <Chip label={params.value} size="small" sx={{ fontWeight: 700, background: isLow ? 'rgba(255,107,107,0.2)' : 'rgba(102,187,106,0.15)', color: isLow ? '#FF6B6B' : '#66BB6A' }} />;
      },
    },
    { field: 'lowThreshold', headerName: 'Min', width: 80 },
    { field: 'price', headerName: 'Price', width: 90, valueFormatter: (value: any) => value ? `$${Number(value).toFixed(2)}` : '-' },
    { field: 'actions', headerName: 'Quick Stock', width: 160, sortable: false,
      renderCell: (params: any) => (
        <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
          <Button size="small" variant="outlined" sx={{ minWidth: 32, px: 0, borderColor: 'rgba(255,255,255,0.15)' }}
            onClick={() => handleQuantityChange(params.row.id, Math.max(0, params.row.quantity - 1))}>−</Button>
          <Typography variant="body2" sx={{ minWidth: 24, textAlign: 'center' }}>{params.row.quantity}</Typography>
          <Button size="small" variant="outlined" sx={{ minWidth: 32, px: 0, borderColor: 'rgba(255,255,255,0.15)' }}
            onClick={() => handleQuantityChange(params.row.id, params.row.quantity + 1)}>+</Button>
        </Box>
      ),
    },
  ];

  return (
    <Fade in timeout={500}>
      <Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Inventory2 sx={{ color: '#FFB74D', fontSize: 32 }} />
            <Typography variant="h4" fontWeight={700}>Inventory</Typography>
          </Box>
          <Button variant="contained" startIcon={<Add />} onClick={() => setDialogOpen(true)}>Add Item</Button>
        </Box>

        <Box sx={{ background: 'rgba(26,31,58,0.7)', borderRadius: 4, border: '1px solid rgba(255,255,255,0.08)', overflow: 'hidden' }}>
          <DataGrid rows={items} columns={columns} loading={loading} autoHeight
            pageSizeOptions={[10, 25]} initialState={{ pagination: { paginationModel: { pageSize: 10 } } }}
            sx={{ border: 'none', '& .MuiDataGrid-columnHeaders': { background: 'rgba(255,255,255,0.03)' }, '& .MuiDataGrid-row:hover': { background: 'rgba(79,195,247,0.04)' }, '& .MuiDataGrid-cell': { borderColor: 'rgba(255,255,255,0.04)' } }}
          />
        </Box>

        <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { background: '#1a1f3a', borderRadius: 4 } }}>
          <DialogTitle>Add Inventory Item</DialogTitle>
          <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: '16px !important' }}>
            <TextField label="Product Name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} fullWidth required />
            <TextField label="SKU" value={form.sku} onChange={e => setForm({ ...form, sku: e.target.value })} fullWidth />
            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField label="Quantity" type="number" value={form.quantity} onChange={e => setForm({ ...form, quantity: +e.target.value })} fullWidth />
              <TextField label="Low Threshold" type="number" value={form.lowThreshold} onChange={e => setForm({ ...form, lowThreshold: +e.target.value })} fullWidth />
            </Box>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField label="Price" type="number" value={form.price} onChange={e => setForm({ ...form, price: +e.target.value })} fullWidth />
              <TextField label="Category" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} fullWidth />
            </Box>
          </DialogContent>
          <DialogActions sx={{ p: 3 }}><Button onClick={() => setDialogOpen(false)}>Cancel</Button><Button variant="contained" onClick={handleCreate}>Add Item</Button></DialogActions>
        </Dialog>
      </Box>
    </Fade>
  );
};

export default InventoryPage;
