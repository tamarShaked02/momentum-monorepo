import React, { useEffect, useState, useCallback } from "react";
import {
  Box,
  Typography,
  Card,
  CardContent,
  Fade,
  Grid,
  TextField,
  Chip,
  IconButton,
} from "@mui/material";
import { BarChart, AccountBalance, ArrowBack } from "@mui/icons-material";
import {
  BarChart as ReBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
  Legend,
} from "recharts";
import api from "../api/client";

type Granularity = "year" | "month" | "week" | "day";

function getGranularity(startDate: string, endDate: string): Granularity {
  const diffMs = new Date(endDate).getTime() - new Date(startDate).getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  if (diffDays > 365) return "year";
  if (diffDays > 60) return "month";
  if (diffDays > 14) return "week";
  return "day";
}

function groupByGranularity(
  appointments: any[],
  startDate: string,
  endDate: string,
  granularity: Granularity,
) {
  const safeAppointments = Array.isArray(appointments) ? appointments : [];
  const start = new Date(startDate);
  const end = new Date(endDate);
  const buckets: {
    label: string;
    from: string;
    to: string;
    revenue: number;
    appointments: number;
    completed: number;
  }[] = [];

  if (granularity === "year") {
    for (let y = start.getFullYear(); y <= end.getFullYear(); y++) {
      const from = `${y}-01-01`;
      const to = `${y}-12-31`;
      buckets.push({
        label: `${y}`,
        from,
        to,
        revenue: 0,
        appointments: 0,
        completed: 0,
      });
    }
  } else if (granularity === "month") {
    const d = new Date(start.getFullYear(), start.getMonth(), 1);
    while (d <= end) {
      const from = d.toISOString().split("T")[0];
      const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0);
      const to = lastDay.toISOString().split("T")[0];
      buckets.push({
        label: d.toLocaleDateString("en", { month: "short", year: "numeric" }),
        from,
        to,
        revenue: 0,
        appointments: 0,
        completed: 0,
      });
      d.setMonth(d.getMonth() + 1);
    }
  } else if (granularity === "week") {
    const d = new Date(start);
    while (d <= end) {
      const weekEnd = new Date(d);
      weekEnd.setDate(weekEnd.getDate() + 6);
      const from = d.toISOString().split("T")[0];
      const to = (weekEnd > end ? end : weekEnd).toISOString().split("T")[0];
      buckets.push({
        label: `${d.getDate()}/${d.getMonth() + 1}`,
        from,
        to,
        revenue: 0,
        appointments: 0,
        completed: 0,
      });
      d.setDate(d.getDate() + 7);
    }
  } else {
    const d = new Date(start);
    while (d <= end) {
      const from = d.toISOString().split("T")[0];
      buckets.push({
        label: d.toLocaleDateString("en", { weekday: "short", day: "numeric" }),
        from,
        to: from,
        revenue: 0,
        appointments: 0,
        completed: 0,
      });
      d.setDate(d.getDate() + 1);
    }
  }

  for (const apt of safeAppointments) {
    const aptDate = apt.startTime?.split("T")[0];
    if (!aptDate || aptDate < startDate || aptDate > endDate) continue;
    for (const bucket of buckets) {
      if (aptDate >= bucket.from && aptDate <= bucket.to) {
        bucket.appointments++;
        if (apt.status === "completed") {
          bucket.completed++;
          bucket.revenue += apt.price || 0;
        }
        break;
      }
    }
  }

  return buckets;
}

const AnalyticsPage: React.FC = () => {
  const [appointments, setAppointments] = useState<any[]>([]);
  const [inventoryCost, setInventoryCost] = useState(0);
  const [_loading, setLoading] = useState(true);

  const today = new Date();
  const monthAgo = new Date(today);
  monthAgo.setMonth(monthAgo.getMonth() - 1);

  const [startDate, setStartDate] = useState(
    monthAgo.toISOString().split("T")[0],
  );
  const [endDate, setEndDate] = useState(today.toISOString().split("T")[0]);
  const [drillStack, setDrillStack] = useState<
    { start: string; end: string }[]
  >([]);

  useEffect(() => {
    api
      .get("/appointments")
      .then((res) => {
        const list = Array.isArray(res.data) ? res.data : res.data?.data || [];
        setAppointments(list);
        setLoading(false);
      })
      .catch(() => setLoading(false));
    api
      .get("/inventory")
      .then((res) => {
        const items = Array.isArray(res.data) ? res.data : res.data?.data || [];
        const total = items.reduce(
          (sum: number, item: any) =>
            sum + (item.price || 0) * (item.quantity || 0),
          0,
        );
        setInventoryCost(total);
      })
      .catch(() => {});
  }, []);

  const granularity = getGranularity(startDate, endDate);
  const chartData = groupByGranularity(
    appointments,
    startDate,
    endDate,
    granularity,
  );

  const totalRevenue = chartData.reduce((s, d) => s + d.revenue, 0);
  const totalAppts = chartData.reduce((s, d) => s + d.appointments, 0);
  const totalCompleted = chartData.reduce((s, d) => s + d.completed, 0);
  const occupancyRate =
    totalAppts > 0 ? Math.round((totalCompleted / totalAppts) * 100) : 0;
  const profit = totalRevenue - inventoryCost;

  // Cumulative for area chart
  let cumulative = 0;
  const profitData = chartData.map((d) => {
    cumulative += d.revenue;
    return {
      name: d.label,
      revenue: cumulative,
      profit: cumulative - inventoryCost,
    };
  });

  const handleDrillDown = useCallback(
    (data: any) => {
      if (!data || granularity === "day") return;
      // Recharts passes the index as activeTooltipIndex or we find it via activeLabel
      let idx = data.activeTooltipIndex;
      if (idx == null && data.activeLabel) {
        idx = chartData.findIndex((d) => d.label === data.activeLabel);
      }
      if (idx == null || idx < 0 || !chartData[idx]) return;
      const bucket = chartData[idx];
      setDrillStack((prev) => [...prev, { start: startDate, end: endDate }]);
      setStartDate(bucket.from);
      setEndDate(bucket.to);
    },
    [chartData, granularity, startDate, endDate],
  );

  const handleBack = () => {
    const prev = drillStack[drillStack.length - 1];
    if (prev) {
      setStartDate(prev.start);
      setEndDate(prev.end);
      setDrillStack((s) => s.slice(0, -1));
    }
  };

  return (
    <Fade in timeout={500}>
      <Box>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            mb: 3,
            flexWrap: "wrap",
            gap: 2,
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            {drillStack.length > 0 && (
              <IconButton onClick={handleBack} size="small" sx={{ mr: 1 }}>
                <ArrowBack />
              </IconButton>
            )}
            <BarChart sx={{ color: "#FFB74D", fontSize: 32 }} />
            <Typography variant="h4">Analytics</Typography>
            <Chip
              label={granularity}
              size="small"
              sx={{ ml: 1, textTransform: "capitalize" }}
            />
          </Box>
          <Box sx={{ display: "flex", gap: 2, alignItems: "center" }}>
            <Box>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: "block", mb: 0.5 }}
              >
                From
              </Typography>
              <TextField
                type="date"
                size="small"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setDrillStack([]);
                }}
              />
            </Box>
            <Box>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: "block", mb: 0.5 }}
              >
                To
              </Typography>
              <TextField
                type="date"
                size="small"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setDrillStack([]);
                }}
              />
            </Box>
          </Box>
        </Box>

        {granularity !== "day" && (
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ mb: 2, display: "block" }}
          >
            Click any bar or point to drill down into that period
          </Typography>
        )}

        {/* Summary Cards */}
        <Grid container spacing={3} sx={{ mb: 3 }}>
          {[
            {
              label: "Revenue",
              value: `₪${totalRevenue}`,
              color: "#66BB6A",
              sub: "From completed appointments",
            },
            {
              label: "Costs (Inventory)",
              value: `₪${Math.round(inventoryCost)}`,
              color: "#FF6B6B",
              sub: "Total inventory value",
            },
            {
              label: "Profit",
              value: `₪${Math.round(profit)}`,
              color: profit >= 0 ? "#4FC3F7" : "#FF6B6B",
              sub: `${totalCompleted} completed, ${occupancyRate}% rate`,
            },
          ].map((card, i) => (
            <Grid size={{ xs: 12, sm: 4 }} key={i}>
              <Card>
                <CardContent sx={{ textAlign: "center", py: 2.5 }}>
                  <Typography variant="overline" color="text.secondary">
                    {card.label}
                  </Typography>
                  <Typography
                    variant="h4"
                    sx={{ fontWeight: 700, color: card.color, my: 0.5 }}
                  >
                    {card.value}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {card.sub}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>

        {/* Charts */}
        <Grid container spacing={3}>
          <Grid size={{ xs: 12, md: 7 }}>
            <Card>
              <CardContent>
                <Box
                  sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}
                >
                  <AccountBalance sx={{ color: "#66BB6A" }} />
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    Revenue vs Profit
                  </Typography>
                </Box>
                <ResponsiveContainer width="100%" height={250}>
                  <AreaChart
                    data={profitData}
                    onClick={handleDrillDown}
                    style={{
                      cursor: granularity !== "day" ? "pointer" : "default",
                    }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="rgba(255,255,255,0.06)"
                    />
                    <XAxis dataKey="name" stroke="#9AA0B4" fontSize={11} />
                    <YAxis stroke="#9AA0B4" fontSize={11} />
                    <Tooltip
                      contentStyle={{
                        background: "#1a1f3a",
                        border: "1px solid rgba(255,255,255,0.1)",
                        borderRadius: 12,
                      }}
                    />
                    <Legend />
                    <Area
                      type="monotone"
                      dataKey="revenue"
                      stroke="#66BB6A"
                      fill="rgba(102,187,106,0.15)"
                      strokeWidth={2}
                      name="Revenue"
                    />
                    <Area
                      type="monotone"
                      dataKey="profit"
                      stroke="#4FC3F7"
                      fill="rgba(79,195,247,0.1)"
                      strokeWidth={2}
                      name="Profit"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, md: 5 }}>
            <Card>
              <CardContent>
                <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
                  Appointments
                </Typography>
                <ResponsiveContainer width="100%" height={250}>
                  <ReBarChart
                    data={chartData}
                    onClick={handleDrillDown}
                    style={{
                      cursor: granularity !== "day" ? "pointer" : "default",
                    }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="rgba(255,255,255,0.06)"
                    />
                    <XAxis dataKey="label" stroke="#9AA0B4" fontSize={11} />
                    <YAxis stroke="#9AA0B4" fontSize={11} />
                    <Tooltip
                      contentStyle={{
                        background: "#1a1f3a",
                        border: "1px solid rgba(255,255,255,0.1)",
                        borderRadius: 12,
                      }}
                    />
                    <Legend />
                    <Bar
                      dataKey="appointments"
                      fill="#4FC3F7"
                      radius={[4, 4, 0, 0]}
                      name="Scheduled"
                    />
                    <Bar
                      dataKey="completed"
                      fill="#66BB6A"
                      radius={[4, 4, 0, 0]}
                      name="Completed"
                    />
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
