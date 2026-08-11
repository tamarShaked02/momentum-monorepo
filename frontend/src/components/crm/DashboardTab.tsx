import React, { useCallback, useEffect, useState } from "react";
import DatePickerInput from "../calendar/DatePickerInput";
import {
  Box,
  Card,
  CardContent,
  CircularProgress,
  Grid,
  TextField,
  Typography,
  useTheme,
} from "@mui/material";
import {
  AttachMoney,
  EmojiEvents,
  ThumbDown,
  TrendingUp,
  Speed,
  Timer,
} from "@mui/icons-material";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { getCRMDashboard } from "../../api/crm";
import type {
  CRMDashboardData,
  CRMDashboardParams,
  FunnelStage,
} from "../../types/crm";

// ─── Component ───────────────────────────────────────────────────────────────

const DashboardTab: React.FC = () => {
  const theme = useTheme();

  // Date range filter state
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // Data state
  const [dashboardData, setDashboardData] = useState<CRMDashboardData | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ─── Fetch dashboard data ────────────────────────────────────────────

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: CRMDashboardParams = {};
      if (startDate) params.startDate = startDate;
      if (endDate) params.endDate = endDate;
      const data = await getCRMDashboard(params);
      setDashboardData(data);
    } catch {
      setError("Failed to load dashboard data");
      setDashboardData(null);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  // ─── Metric Cards Config ─────────────────────────────────────────────

  const metricCards = dashboardData
    ? [
        {
          label: "Total Pipeline Value",
          value: `$${dashboardData.metrics.totalPipelineValue.toLocaleString()}`,
          icon: <AttachMoney />,
          color: theme.palette.primary.main,
        },
        {
          label: "Weighted Pipeline Value",
          value: `$${dashboardData.metrics.weightedPipelineValue.toLocaleString()}`,
          icon: <TrendingUp />,
          color: theme.palette.secondary.main,
        },
        {
          label: "Deals Won",
          value: dashboardData.metrics.dealsWon.toString(),
          icon: <EmojiEvents />,
          color: theme.palette.success.main,
        },
        {
          label: "Deals Lost",
          value: dashboardData.metrics.dealsLost.toString(),
          icon: <ThumbDown />,
          color: theme.palette.error.main,
        },
        {
          label: "Win Rate",
          value: `${dashboardData.metrics.winRate.toFixed(1)}%`,
          icon: <Speed />,
          color: theme.palette.info.main,
        },
        {
          label: "Avg Cycle Duration",
          value: `${Math.round(dashboardData.metrics.averageCycleDuration)} days`,
          icon: <Timer />,
          color: theme.palette.warning.main,
        },
      ]
    : [];

  // ─── Render: Loading / Error states ──────────────────────────────────

  if (loading && !dashboardData) {
    return (
      <Box
        sx={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          minHeight: 300,
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  if (error && !dashboardData) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography color="error">{error}</Typography>
      </Box>
    );
  }

  // ─── Main Render ─────────────────────────────────────────────────────

  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
      {/* Date Range Filter */}
      <Box sx={{ display: "flex", gap: 2, alignItems: "center" }}>
        <Box sx={{ width: 170 }}>
          <DatePickerInput
            label="Start Date"
            value={startDate}
            onChange={setStartDate}
            type="date"
          />
        </Box>
        <Box sx={{ width: 170 }}>
          <DatePickerInput
            label="End Date"
            value={endDate}
            onChange={setEndDate}
            type="date"
          />
        </Box>
        {loading && <CircularProgress size={20} />}
      </Box>

      {/* Metric Cards */}
      {dashboardData && (
        <Grid container spacing={2}>
          {metricCards.map((card, idx) => (
            <Grid size={{ xs: 12, sm: 6, md: 4, lg: 2 }} key={idx}>
              <Card
                sx={{
                  height: "100%",
                  borderTop: `3px solid ${card.color}`,
                }}
              >
                <CardContent sx={{ py: 2 }}>
                  <Box sx={{ textAlign: "center" }}>
                    <Box sx={{ color: card.color, mb: 0.5 }}>{card.icon}</Box>
                    <Typography
                      variant="overline"
                      color="text.secondary"
                      sx={{ fontSize: "0.65rem", lineHeight: 1.4 }}
                    >
                      {card.label}
                    </Typography>
                    <Typography
                      variant="h5"
                      sx={{ fontWeight: 700, color: card.color, mt: 0.5 }}
                    >
                      {card.value}
                    </Typography>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      {/* Charts Row */}
      {dashboardData && (
        <Grid container spacing={3}>
          {/* Revenue Forecast Chart */}
          <Grid size={{ xs: 12, md: 7 }}>
            <Card>
              <CardContent>
                <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
                  Revenue Forecast
                </Typography>
                {dashboardData.forecast.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={dashboardData.forecast}>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke={theme.palette.divider}
                      />
                      <XAxis
                        dataKey="month"
                        stroke={theme.palette.text.secondary}
                        fontSize={12}
                      />
                      <YAxis
                        stroke={theme.palette.text.secondary}
                        fontSize={12}
                        tickFormatter={(value: number) =>
                          `$${value.toLocaleString()}`
                        }
                      />
                      <Tooltip
                        contentStyle={{
                          background: theme.palette.background.paper,
                          border: `1px solid ${theme.palette.divider}`,
                          borderRadius: 8,
                          color: theme.palette.text.primary,
                        }}
                        formatter={(value) => [
                          `$${Number(value).toLocaleString()}`,
                          "Weighted Value",
                        ]}
                      />
                      <Bar
                        dataKey="weightedValue"
                        name="Weighted Value"
                        fill={theme.palette.primary.main}
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <Typography
                    color="text.secondary"
                    sx={{ py: 4, textAlign: "center" }}
                  >
                    No forecast data available
                  </Typography>
                )}
              </CardContent>
            </Card>
          </Grid>

          {/* Pipeline Funnel Visualization */}
          <Grid size={{ xs: 12, md: 5 }}>
            <Card>
              <CardContent>
                <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
                  Pipeline Funnel
                </Typography>
                {dashboardData.funnel.length > 0 ? (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart
                      data={dashboardData.funnel}
                      layout="vertical"
                      margin={{ left: 20 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke={theme.palette.divider}
                      />
                      <XAxis
                        type="number"
                        stroke={theme.palette.text.secondary}
                        fontSize={12}
                      />
                      <YAxis
                        type="category"
                        dataKey="stageName"
                        stroke={theme.palette.text.secondary}
                        fontSize={12}
                        width={100}
                      />
                      <Tooltip
                        contentStyle={{
                          background: theme.palette.background.paper,
                          border: `1px solid ${theme.palette.divider}`,
                          borderRadius: 8,
                          color: theme.palette.text.primary,
                        }}
                        formatter={(value, name) => {
                          if (name === "totalValue")
                            return [
                              `$${Number(value).toLocaleString()}`,
                              "Total Value",
                            ];
                          return [value, "Deal Count"];
                        }}
                      />
                      <Bar
                        dataKey="dealCount"
                        name="dealCount"
                        fill={theme.palette.secondary.main}
                        radius={[0, 4, 4, 0]}
                      >
                        {dashboardData.funnel.map(
                          (_entry: FunnelStage, index: number) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={
                                index % 2 === 0
                                  ? theme.palette.primary.main
                                  : theme.palette.secondary.main
                              }
                            />
                          ),
                        )}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <Typography
                    color="text.secondary"
                    sx={{ py: 4, textAlign: "center" }}
                  >
                    No funnel data available
                  </Typography>
                )}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}
    </Box>
  );
};

export default DashboardTab;
