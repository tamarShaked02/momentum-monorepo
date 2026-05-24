import React, { useEffect, useState } from 'react';
import { Box, Typography, Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Fade, Chip, Drawer, Divider, IconButton } from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import type { GridColDef } from '@mui/x-data-grid';
import { Add, People, Close, History } from '@mui/icons-material';
import api from '../api/client';
import type { Customer, Appointment } from '../types';

const CRMPage: React.FC = () => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [history, setHistory] = useState<Appointment[]>([]);
  const [form, setForm] = useState({ name: '', email: '', phone: '', notes: '' });

  const fetchCustomers = () => { api.get('/customers').then(res => { setCustomers(res.data); setLoading(false); }).catch(() => setLoading(false)); };
  useEffect(() => { fetchCustomers(); }, []);

  const handleCreate = async () => {
    if (!form.name) return;
    await api.post('/customers', form);
    setDialogOpen(false);
    setForm({ name: '', email: '', phone: '', notes: '' });
    fetchCustomers();
  };

  const openProfile = async (customer: Customer) => {
    setSelectedCustomer(customer);
    setDrawerOpen(true);
    try {
      const res = await api.get(`/customers/${customer.id}/history`);
      setHistory(res.data.appointments || []);
    } catch { setHistory([]); }
  };

  const columns: GridColDef[] = [
    { field: 'name', headerName: 'Name', flex: 1, minWidth: 140 },
    { field: 'email', headerName: 'Email', flex: 1, minWidth: 160 },
    { field: 'phone', headerName: 'Phone', flex: 0.8, minWidth: 120 },
    { field: 'appointments', headerName: 'Visits', width: 90, valueGetter: (_v: any, row: any) => row._count?.appointments ?? 0 },
    { field: 'createdAt', headerName: 'Added', width: 120, valueFormatter: (value: any) => new Date(value).toLocaleDateString() },
    { field: 'actions', headerName: '', width: 100, sortable: false,
      renderCell: (params: any) => <Button size="small" onClick={() => openProfile(params.row)} sx={{ color: '#4FC3F7' }}>View</Button>,
    },
  ];

  return (
    <Fade in timeout={500}>
      <Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <People sx={{ color: '#BA68C8', fontSize: 32 }} />
            <Typography variant="h4" fontWeight={700}>Customers</Typography>
          </Box>
          <Button variant="contained" startIcon={<Add />} onClick={() => setDialogOpen(true)}>Add Customer</Button>
        </Box>

        <Box sx={{ background: 'rgba(26,31,58,0.7)', borderRadius: 4, border: '1px solid rgba(255,255,255,0.08)', overflow: 'hidden' }}>
          <DataGrid rows={customers} columns={columns} loading={loading} autoHeight
            pageSizeOptions={[10, 25]} initialState={{ pagination: { paginationModel: { pageSize: 10 } } }}
            sx={{ border: 'none', '& .MuiDataGrid-columnHeaders': { background: 'rgba(255,255,255,0.03)' }, '& .MuiDataGrid-row:hover': { background: 'rgba(79,195,247,0.04)' }, '& .MuiDataGrid-cell': { borderColor: 'rgba(255,255,255,0.04)' } }}
          />
        </Box>

        {/* Create Dialog */}
        <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { background: '#1a1f3a', borderRadius: 4 } }}>
          <DialogTitle>Add Customer</DialogTitle>
          <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: '16px !important' }}>
            <TextField label="Name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} fullWidth required />
            <TextField label="Email" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} fullWidth />
            <TextField label="Phone" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} fullWidth />
            <TextField label="Notes" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} multiline rows={2} fullWidth />
          </DialogContent>
          <DialogActions sx={{ p: 3 }}><Button onClick={() => setDialogOpen(false)}>Cancel</Button><Button variant="contained" onClick={handleCreate}>Save</Button></DialogActions>
        </Dialog>

        {/* Profile Drawer */}
        <Drawer anchor="right" open={drawerOpen} onClose={() => setDrawerOpen(false)} PaperProps={{ sx: { width: { xs: '100%', sm: 400 }, background: '#0d1130', p: 3 } }}>
          {selectedCustomer && (
            <Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h5" fontWeight={700}>{selectedCustomer.name}</Typography>
                <IconButton onClick={() => setDrawerOpen(false)}><Close /></IconButton>
              </Box>
              <Box sx={{ mb: 3 }}>
                {selectedCustomer.email && <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>📧 {selectedCustomer.email}</Typography>}
                {selectedCustomer.phone && <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>📱 {selectedCustomer.phone}</Typography>}
                {selectedCustomer.notes && <Typography variant="body2" color="text.secondary" sx={{ mt: 1, p: 1.5, background: 'rgba(255,255,255,0.03)', borderRadius: 2 }}>📝 {selectedCustomer.notes}</Typography>}
              </Box>
              <Divider sx={{ borderColor: 'rgba(255,255,255,0.06)', mb: 2 }} />
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <History sx={{ color: '#4FC3F7' }} />
                <Typography variant="h6" fontWeight={600}>Appointment History</Typography>
              </Box>
              {history.length > 0 ? history.map(apt => (
                <Box key={apt.id} sx={{ py: 1.5, borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                    <Typography variant="body2" fontWeight={500}>{apt.title}</Typography>
                    <Chip label={apt.status} size="small" sx={{ textTransform: 'capitalize', fontSize: '0.7rem' }} />
                  </Box>
                  <Typography variant="caption" color="text.secondary">{new Date(apt.startTime).toLocaleString()}</Typography>
                </Box>
              )) : <Typography variant="body2" color="text.secondary">No appointments yet.</Typography>}
            </Box>
          )}
        </Drawer>
      </Box>
    </Fade>
  );
};

export default CRMPage;
