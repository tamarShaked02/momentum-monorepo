import React, { useEffect, useState } from 'react';
import { Box, Typography, Card, CardContent, Fade, Grid } from '@mui/material';
import { BarChart, TrendingUp } from '@mui/icons-material';
import { BarChart as ReBarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Legend } from 'recharts';
import api from '../api/client';

const AnalyticsPage: React.FC = () => {
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/appointments').then(res => {
      setAppointments(res.data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  // Generate daily data for last 7 days
  const getLast7Days = () => {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const dayAppts = appointments.filter(a => a.startTime?.startsWith(dateStr));
      const completed = dayAppts.filter(a => a.status === 'completed').length;
      days.push({
        name: d.toLocaleDateString('en', { weekday: 'short' }),
        appointments: dayAppts.length,
        completed,
        revenue: completed * 50, // Estimate $50 per completed appointment
      });
    }
    return days;
  };

  const chartData = getLast7Days();
  const totalRevenue = chartData.reduce((s, d) => s + d.revenue, 0);
  const totalAppts = chartData.reduce((s, d) => s + d.appointments, 0);
  const totalCompleted = chartData.reduce((s, d) => s + d.completed, 0);
  const occupancyRate = totalAppts > 0 ? Math.round((totalCompleted / totalAppts) * 100) : 0;

  return (
    <Fade in timeout={500}>
      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 4 }}>
          <BarChart sx={{ color: '#FFB74D', fontSize: 32 }} />
          <Typography variant="h4" fontWeight={700}>Analytics</Typography>
        </Box>

        {/* Summary Cards */}
        <Grid container spacing={3} sx={{ mb: 4 }}>
          {[
            { label: 'Weekly Revenue', value: `$${totalRevenue}`, color: '#66BB6A', sub: 'Estimated at $50/appointment' },
            { label: 'Total Appointments', value: totalAppts, color: '#4FC3F7', sub: 'Last 7 days' },
            { label: 'Completed', value: totalCompleted, color: '#FFB74D', sub: `${occupancyRate}% completion rate` },
          ].map((card, i) => (
            <Grid size={{ xs: 12, sm: 4 }} key={i}>
              <Card>
                <CardContent sx={{ textAlign: 'center', py: 3 }}>
                  <Typography variant="overline" color="text.secondary">{card.label}</Typography>
                  <Typography variant="h3" fontWeight={700} sx={{ color: card.color, my: 1 }}>{card.value}</Typography>
                  <Typography variant="caption" color="text.secondary">{card.sub}</Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>

        {/* Revenue Chart */}
        <Grid container spacing={3}>
          <Grid size={{ xs: 12, md: 7 }}>
            <Card>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
                  <TrendingUp sx={{ color: '#4FC3F7' }} />
                  <Typography variant="h6" fontWeight={600}>Revenue Trend</Typography>
                </Box>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                    <XAxis dataKey="name" stroke="#9AA0B4" fontSize={12} />
                    <YAxis stroke="#9AA0B4" fontSize={12} />
                    <Tooltip contentStyle={{ background: '#1a1f3a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12 }} />
                    <Line type="monotone" dataKey="revenue" stroke="#4FC3F7" strokeWidth={3} dot={{ fill: '#4FC3F7', r: 5 }} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </Grid>

          <Grid size={{ xs: 12, md: 5 }}>
            <Card>
              <CardContent>
                <Typography variant="h6" fontWeight={600} sx={{ mb: 3 }}>Appointments by Day</Typography>
                <ResponsiveContainer width="100%" height={300}>
                  <ReBarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                    <XAxis dataKey="name" stroke="#9AA0B4" fontSize={12} />
                    <YAxis stroke="#9AA0B4" fontSize={12} />
                    <Tooltip contentStyle={{ background: '#1a1f3a', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12 }} />
                    <Legend />
                    <Bar dataKey="appointments" fill="#4FC3F7" radius={[4, 4, 0, 0]} name="Scheduled" />
                    <Bar dataKey="completed" fill="#66BB6A" radius={[4, 4, 0, 0]} name="Completed" />
                  </ReBarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Box>
    </Fade>
  );
};

export default AnalyticsPage;
