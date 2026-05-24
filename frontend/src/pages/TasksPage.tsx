import React, { useEffect, useState } from 'react';
import { Box, Typography, Card, CardContent, Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem, Chip, Fade, IconButton } from '@mui/material';
import { Add, CheckCircle, Delete } from '@mui/icons-material';
import api from '../api/client';
import type { Task } from '../types';

const statusColumns = [
  { key: 'pending', label: 'To Do', color: '#FFB74D' },
  { key: 'in_progress', label: 'In Progress', color: '#4FC3F7' },
  { key: 'completed', label: 'Completed', color: '#66BB6A' },
];

const priorityColors: Record<string, string> = { high: '#FF6B6B', medium: '#FFB74D', low: '#66BB6A' };

const TasksPage: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', priority: 'medium', category: '', dueDate: '' });

  const fetchTasks = () => { api.get('/tasks').then(res => { setTasks(res.data); setLoading(false); }).catch(() => setLoading(false)); };
  useEffect(() => { fetchTasks(); }, []);

  const handleCreate = async () => {
    if (!form.title) return;
    await api.post('/tasks', { ...form, dueDate: form.dueDate || null });
    setDialogOpen(false);
    setForm({ title: '', description: '', priority: 'medium', category: '', dueDate: '' });
    fetchTasks();
  };

  const handleStatusChange = async (id: string, status: string) => {
    await api.put(`/tasks/${id}`, { status });
    fetchTasks();
  };

  const handleDelete = async (id: string) => {
    await api.delete(`/tasks/${id}`);
    fetchTasks();
  };

  const getTasksByStatus = (status: string) => tasks.filter(t => t.status === status);

  return (
    <Fade in timeout={500}>
      <Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CheckCircle sx={{ color: '#66BB6A', fontSize: 32 }} />
            <Typography variant="h4" fontWeight={700}>Tasks</Typography>
          </Box>
          <Button variant="contained" startIcon={<Add />} onClick={() => setDialogOpen(true)}>Add Task</Button>
        </Box>

        {/* Kanban Board */}
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' }, gap: 3, minHeight: 400 }}>
          {statusColumns.map(col => (
            <Box key={col.key}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2, px: 1 }}>
                <Box sx={{ width: 10, height: 10, borderRadius: '50%', background: col.color }} />
                <Typography variant="subtitle1" fontWeight={600}>{col.label}</Typography>
                <Chip label={getTasksByStatus(col.key).length} size="small" sx={{ ml: 'auto', background: `${col.color}22`, color: col.color }} />
              </Box>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, minHeight: 200, p: 1.5, borderRadius: 3, background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.06)' }}>
                {getTasksByStatus(col.key).map(task => (
                  <Card key={task.id} sx={{ background: 'rgba(26,31,58,0.9)', cursor: 'pointer', '&:hover': { transform: 'translateY(-1px)' } }}>
                    <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', mb: 1 }}>
                        <Typography variant="body2" fontWeight={600} sx={{ flexGrow: 1 }}>{task.title}</Typography>
                        <IconButton size="small" onClick={() => handleDelete(task.id)} sx={{ color: 'rgba(255,255,255,0.3)', p: 0.3 }}><Delete fontSize="small" /></IconButton>
                      </Box>
                      {task.description && <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>{task.description}</Typography>}
                      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', alignItems: 'center' }}>
                        <Chip label={task.priority} size="small" sx={{ fontSize: '0.65rem', height: 20, background: `${priorityColors[task.priority]}22`, color: priorityColors[task.priority] }} />
                        {task.category && <Chip label={task.category} size="small" variant="outlined" sx={{ fontSize: '0.65rem', height: 20, borderColor: 'rgba(255,255,255,0.1)' }} />}
                        {task.dueDate && <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>{new Date(task.dueDate).toLocaleDateString()}</Typography>}
                      </Box>
                      {col.key !== 'completed' && (
                        <Box sx={{ mt: 1.5, display: 'flex', gap: 0.5 }}>
                          {col.key === 'pending' && <Button size="small" fullWidth variant="outlined" sx={{ fontSize: '0.7rem', borderColor: 'rgba(79,195,247,0.3)', color: '#4FC3F7' }} onClick={() => handleStatusChange(task.id, 'in_progress')}>Start</Button>}
                          {col.key === 'in_progress' && <Button size="small" fullWidth variant="outlined" sx={{ fontSize: '0.7rem', borderColor: 'rgba(102,187,106,0.3)', color: '#66BB6A' }} onClick={() => handleStatusChange(task.id, 'completed')}>Done</Button>}
                        </Box>
                      )}
                    </CardContent>
                  </Card>
                ))}
                {getTasksByStatus(col.key).length === 0 && (
                  <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4, opacity: 0.5 }}>No tasks</Typography>
                )}
              </Box>
            </Box>
          ))}
        </Box>

        <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth PaperProps={{ sx: { background: '#1a1f3a', borderRadius: 4 } }}>
          <DialogTitle>Add Task</DialogTitle>
          <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: '16px !important' }}>
            <TextField label="Title" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} fullWidth required />
            <TextField label="Description" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} multiline rows={2} fullWidth />
            <Box sx={{ display: 'flex', gap: 2 }}>
              <TextField label="Priority" select value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })} fullWidth>
                <MenuItem value="low">Low</MenuItem><MenuItem value="medium">Medium</MenuItem><MenuItem value="high">High</MenuItem>
              </TextField>
              <TextField label="Category" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} fullWidth placeholder="e.g., operational" />
            </Box>
            <TextField label="Due Date" type="date" value={form.dueDate} onChange={e => setForm({ ...form, dueDate: e.target.value })} fullWidth InputLabelProps={{ shrink: true }} />
          </DialogContent>
          <DialogActions sx={{ p: 3 }}><Button onClick={() => setDialogOpen(false)}>Cancel</Button><Button variant="contained" onClick={handleCreate}>Add Task</Button></DialogActions>
        </Dialog>
      </Box>
    </Fade>
  );
};

export default TasksPage;
