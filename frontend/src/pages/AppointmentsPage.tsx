import React, { useEffect, useState } from 'react';
import { Box, Typography, Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField, Fade, Chip, MenuItem } from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import type { GridColDef } from '@mui/x-data-grid';
import { Add, CalendarMonth } from '@mui/icons-material';
import api from '../api/client';
import type { Appointment } from '../types';

const AppointmentsPage: React.FC = () => {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ title: '', startTime: '', endTime: '', notes: '', status: 'scheduled', source: 'manual' });

  const fetchAppointments = () => {
    api.get('/appointments').then(res => { setAppointments(res.data); setLoading(false); }).catch(() => setLoading(false));
  };

  useEffect(() => { fetchAppointments(); }, []);

  const handleCreate = async () => {
    if (!form.title || !form.startTime || !form.endTime) return;
    await api.post('/appointments', form);
    setDialogOpen(false);
    setForm({ title: '', startTime: '', endTime: '', notes: '', status: 'scheduled', source: 'manual' });
    fetchAppointments();
  };

  const handleStatusChange = async (id: string, status: string) => {
    await api.put(`/appointments/${id}`, { status });
    fetchAppointments();
  };

  const statusColors: Record<string, string> = { scheduled: '#4FC3F7', completed: '#66BB6A', cancelled: '#FF6B6B', no_show: '#FFB74D' };

  const columns: GridColDef[] = [
    { field: 'title', headerName: 'Service', flex: 1, minWidth: 120 },
    { field: 'customerName', headerName: 'Customer', flex: 1, minWidth: 120, valueGetter: (_value: any, row: any) => row.customer?.name || 'Walk-in' },
    { field: 'startTime', headerName: 'Date & Time', flex: 1, minWidth: 160, valueFormatter: (value: any) => new Date(value).toLocaleString() },
    { field: 'status', headerName: 'Status', width: 130,
      renderCell: (params: any) => (
        <Chip label={params.value} size="small" sx={{ background: `${statusColors[params.value] || '#999'}22`, color: statusColors[params.value] || '#999', fontWeight: 600, textTransform: 'capitalize' }} />
      ),
    },
    { field: 'source', headerName: 'Source', width: 110,
      renderCell: (params: any) => <Chip label={params.value} size="small" variant="outlined" sx={{ textTransform: 'capitalize', borderColor: 'rgba(255,255,255,0.15)' }} />,
    },
    { field: 'actions', headerName: 'Actions', width: 200, sortable: false,
      renderCell: (params: any) => (
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          {params.row.status === 'scheduled' && (
            <>
              <Button size="small" onClick={() => handleStatusChange(params.row.id, 'completed')} sx={{ color: '#66BB6A', fontSize: '0.7rem' }}>Complete</Button>
              <Button size="small" onClick={() => handleStatusChange(params.row.id, 'cancelled')} sx={{ color: '#FF6B6B', fontSize: '0.7rem' }}>Cancel</Button>
            </>
          )}
        </Box>
      ),
    },
  ];

  return (
    <Fade in timeout={500}>
      <Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CalendarMonth sx={{ color: '#4FC3F7', fontSize: 32 }} />
            <Typography variant="h4" fontWeight={700}>Appointments</Typography>
          </Box>
          <Button variant="contained" startIcon={<Add />} onClick={() => setDialogOpen(true)}>New Appointment</Button>
        </Box>

        <Box sx={{ background: 'rgba(26,31,58,0.7)', borderRadius: 4, border: '1px solid rgba(255,255,255,0.08)', overflow: 'hidden' }}>
          <DataGrid rows={appointments} columns={columns} loading={loading} autoHeight
            pageSizeOptions={[10, 25, 50]} initialState={{ pagination: { paginationModel: { pageSize: 10 } } }}
            sx={{
              border: 'none', '& .MuiDataGrid-columnHeaders': { background: 'rgba(255,255,255,0.03)' },
              '& .MuiDataGrid-row:hover': { background: 'rgba(79,195,247,0.04)' },
              '& .MuiDataGrid-cell': { borderColor: 'rgba(255,255,255,0.04)' },
            }}
          />
        </Box>

        <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { background: '#1a1f3a', borderRadius: 4 } }}>
          <DialogTitle>New Appointment</DialogTitle>
          <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: '16px !important' }}>
            <TextField label="Service / Title" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} fullWidth />
            <TextField label="Start Time" type="datetime-local" value={form.startTime} onChange={e => setForm({ ...form, startTime: e.target.value })} fullWidth InputLabelProps={{ shrink: true }} />
            <TextField label="End Time" type="datetime-local" value={form.endTime} onChange={e => setForm({ ...form, endTime: e.target.value })} fullWidth InputLabelProps={{ shrink: true }} />
            <TextField label="Source" select value={form.source} onChange={e => setForm({ ...form, source: e.target.value })} fullWidth>
              <MenuItem value="manual">Manual</MenuItem>
              <MenuItem value="walk_in">Walk-in</MenuItem>
            </TextField>
            <TextField label="Notes" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} multiline rows={2} fullWidth />
          </DialogContent>
          <DialogActions sx={{ p: 3 }}>
            <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button variant="contained" onClick={handleCreate}>Create</Button>
          </DialogActions>
        </Dialog>
      </Box>
    </Fade>
  );
};

export default AppointmentsPage;
