import React, { useEffect, useState } from "react";
import {
  Box,
  Typography,
  Card,
  CardContent,
  Chip,
  List,
  ListItem,
  ListItemText,
  Checkbox,
  LinearProgress,
  Fade,
  Grid,
  Skeleton,
} from "@mui/material";
import {
  CalendarMonth,
  Warning,
  TrendingUp,
  Inventory2,
  CheckCircle,
} from "@mui/icons-material";
import api from "../api/client";
import type { DashboardData } from "../types";

const DashboardPage: React.FC = () => {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchSummary = React.useCallback(() => {
    api
      .get("/dashboard/summary")
      .then((res) => {
        setData(res.data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchSummary();
    const handleRefresh = () => fetchSummary();
    window.addEventListener("ai_mutation_success", handleRefresh);
    window.addEventListener("data-updated", handleRefresh);
    return () => {
      window.removeEventListener("ai_mutation_success", handleRefresh);
      window.removeEventListener("data-updated", handleRefresh);
    };
  }, [fetchSummary]);

  const handleTaskComplete = async (taskId: string) => {
    try {
      await api.put(`/tasks/${taskId}`, { status: "done" });
      const res = await api.get("/dashboard/summary");
      setData(res.data);
    } catch (e) {
      console.error("Failed to complete task from dashboard:", e);
    }
  };

  if (loading) {
    return (
      <Box>
        <Skeleton variant="text" width={300} height={48} sx={{ mb: 2 }} />
        <Grid container spacing={3}>
          {[1, 2, 3].map((i) => (
            <Grid size={{ xs: 12, md: 6, lg: 4 }} key={i}>
              <Skeleton
                variant="rounded"
                height={280}
                sx={{ borderRadius: 4 }}
              />
            </Grid>
          ))}
        </Grid>
      </Box>
    );
  }

  if (!data)
    return <Typography color="error">Failed to load dashboard.</Typography>;

  const w = data.widgets;

  return (
    <Fade in timeout={500}>
      <Box>
        <Typography variant="h4" sx={{ mb: 0.5 }}>
          {w.greeting}
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
          Here's your business at a glance.
        </Typography>

        <Grid container spacing={3}>
          {/* Agenda Widget — show next 2 appointments only */}
          {w.scheduling && (
            <Grid size={{ xs: 12, md: 6, lg: 4 }}>
              <Card sx={{ height: "100%" }}>
                <CardContent sx={{ flex: 1 }}>
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      gap: 1,
                      mb: 2,
                    }}
                  >
                    <CalendarMonth sx={{ color: "#4FC3F7" }} />
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>
                      Today's Agenda
                    </Typography>
                    <Chip
                      label={`${w.scheduling.totalToday} appts`}
                      size="small"
                      sx={{
                        ml: "auto",
                        background: "rgba(79,195,247,0.15)",
                        color: "#4FC3F7",
                      }}
                    />
                  </Box>
                  {w.scheduling.upcoming.length > 0 ? (
                    w.scheduling.upcoming.slice(0, 2).map((apt, idx) => (
                      <Card
                        key={apt.id}
                        sx={{
                          background:
                            idx === 0
                              ? "rgba(79,195,247,0.08)"
                              : "rgba(255,255,255,0.03)",
                          border:
                            idx === 0
                              ? "1px solid rgba(79,195,247,0.2)"
                              : "1px solid rgba(255,255,255,0.05)",
                          mb: 1.5,
                          p: 2,
                        }}
                      >
                        {idx === 0 && (
                          <Typography
                            variant="overline"
                            sx={{ color: "#4FC3F7", fontWeight: 600 }}
                          >
                            UP NEXT
                          </Typography>
                        )}
                        <Typography variant="body1" sx={{ fontWeight: 600 }}>
                          {apt.customerName}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {apt.title} •{" "}
                          {new Date(apt.startTime).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </Typography>
                      </Card>
                    ))
                  ) : (
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ py: 2 }}
                    >
                      No more appointments today 🎉
                    </Typography>
                  )}
                </CardContent>
              </Card>
            </Grid>
          )}

          {/* Stock Alert Widget */}
          {w.inventory && (
            <Grid size={{ xs: 12, md: 6, lg: 4 }}>
              <Card sx={{ height: "100%" }}>
                <CardContent sx={{ flex: 1 }}>
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      gap: 1,
                      mb: 2,
                    }}
                  >
                    <Warning
                      sx={{
                        color:
                          w.inventory.criticalLowCount > 0
                            ? "#FF6B6B"
                            : "#66BB6A",
                      }}
                    />
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>
                      Stock Alerts
                    </Typography>
                    <Chip
                      label={
                        w.inventory.criticalLowCount > 0
                          ? `${w.inventory.criticalLowCount} low`
                          : "All good"
                      }
                      size="small"
                      sx={{
                        ml: "auto",
                        background:
                          w.inventory.criticalLowCount > 0
                            ? "rgba(255,107,107,0.15)"
                            : "rgba(102,187,106,0.15)",
                        color:
                          w.inventory.criticalLowCount > 0
                            ? "#FF6B6B"
                            : "#66BB6A",
                      }}
                    />
                  </Box>
                  {w.inventory.criticalItems.length > 0 ? (
                    w.inventory.criticalItems.map((item) => (
                      <Box
                        key={item.id}
                        sx={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          py: 1,
                          borderBottom: "1px solid rgba(255,255,255,0.04)",
                        }}
                      >
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>
                          {item.name}
                        </Typography>
                        <Chip
                          label={`${item.quantity} left`}
                          size="small"
                          sx={{
                            background:
                              item.quantity === 0
                                ? "rgba(255,107,107,0.2)"
                                : "rgba(255,183,77,0.2)",
                            color: item.quantity === 0 ? "#FF6B6B" : "#FFB74D",
                          }}
                        />
                      </Box>
                    ))
                  ) : (
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{ py: 2 }}
                    >
                      All stock levels are healthy ✅
                    </Typography>
                  )}
                </CardContent>
              </Card>
            </Grid>
          )}

          {/* Task List Widget */}
          {w.tasks && (
            <Grid size={{ xs: 12, md: 6, lg: 4 }}>
              <Card sx={{ height: "100%" }}>
                <CardContent sx={{ flex: 1 }}>
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      gap: 1,
                      mb: 2,
                    }}
                  >
                    <CheckCircle sx={{ color: "#66BB6A" }} />
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>
                      Tasks
                    </Typography>
                    <Chip
                      label={`${w.tasks.counts.pending} pending`}
                      size="small"
                      sx={{
                        ml: "auto",
                        background: "rgba(255,183,77,0.15)",
                        color: "#FFB74D",
                      }}
                    />
                  </Box>
                  <Box sx={{ mb: 2 }}>
                    <Box
                      sx={{
                        display: "flex",
                        justifyContent: "space-between",
                        mb: 0.5,
                      }}
                    >
                      <Typography variant="caption" color="text.secondary">
                        Progress
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {w.tasks.counts.completed}/
                        {w.tasks.counts.pending +
                          w.tasks.counts.in_progress +
                          w.tasks.counts.completed}
                      </Typography>
                    </Box>
                    <LinearProgress
                      variant="determinate"
                      value={
                        (w.tasks.counts.completed /
                          Math.max(
                            1,
                            w.tasks.counts.pending +
                              w.tasks.counts.in_progress +
                              w.tasks.counts.completed,
                          )) *
                        100
                      }
                      sx={{
                        height: 6,
                        borderRadius: 3,
                        background: "rgba(255,255,255,0.06)",
                        "& .MuiLinearProgress-bar": {
                          background:
                            "linear-gradient(90deg, #66BB6A, #4FC3F7)",
                          borderRadius: 3,
                        },
                      }}
                    />
                  </Box>
                  <List dense disablePadding>
                    {w.tasks.pendingTasks.slice(0, 4).map((task) => (
                      <ListItem key={task.id} disablePadding sx={{ py: 0.5 }}>
                        <Checkbox
                          size="small"
                          sx={{ p: 0.5, mr: 1, color: "rgba(255,255,255,0.3)" }}
                          onChange={() => handleTaskComplete(task.id)}
                        />
                        <ListItemText
                          primary={task.title}
                          slotProps={{
                            primary: {
                              noWrap: true,
                              sx: {
                                fontSize: "0.875rem",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              },
                            },
                          }}
                        />
                      </ListItem>
                    ))}
                  </List>
                </CardContent>
              </Card>
            </Grid>
          )}

          {/* Inventory Summary Widget (replaces CRM widget) */}
          {w.inventory && (
            <Grid size={{ xs: 12, md: 6, lg: 4 }}>
              <Card sx={{ height: "100%" }}>
                <CardContent sx={{ flex: 1 }}>
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      gap: 1,
                      mb: 2,
                    }}
                  >
                    <Inventory2 sx={{ color: "#FFB74D" }} />
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>
                      Inventory Overview
                    </Typography>
                  </Box>
                  <Box sx={{ display: "flex", gap: 2, mb: 2 }}>
                    <Box
                      sx={{
                        textAlign: "center",
                        flex: 1,
                        p: 2,
                        borderRadius: 2,
                        background: "rgba(102,187,106,0.08)",
                      }}
                    >
                      <Typography
                        variant="h4"
                        sx={{ color: "#66BB6A", fontWeight: 700 }}
                      >
                        {w.inventory.totalItems}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Products
                      </Typography>
                    </Box>
                    <Box
                      sx={{
                        textAlign: "center",
                        flex: 1,
                        p: 2,
                        borderRadius: 2,
                        background: "rgba(255,107,107,0.08)",
                      }}
                    >
                      <Typography
                        variant="h4"
                        sx={{ color: "#FF6B6B", fontWeight: 700 }}
                      >
                        {w.inventory.criticalLowCount}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Low Stock
                      </Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          )}

          {/* Analytics Widget */}
          {w.analytics && (
            <Grid size={{ xs: 12, md: 6, lg: 4 }}>
              <Card sx={{ height: "100%" }}>
                <CardContent
                  sx={{
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "center",
                  }}
                >
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      gap: 1,
                      mb: 3,
                    }}
                  >
                    <TrendingUp sx={{ color: "#FFB74D" }} />
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>
                      Business Health
                    </Typography>
                  </Box>
                  <Box sx={{ display: "flex", gap: 3 }}>
                    <Box sx={{ textAlign: "center", flexGrow: 1 }}>
                      <Typography
                        variant="h3"
                        sx={{ fontWeight: 700, color: "#4FC3F7" }}
                      >
                        {w.analytics.weekCompletedAppointments}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        This Week
                      </Typography>
                    </Box>
                    <Box sx={{ textAlign: "center", flexGrow: 1 }}>
                      <Typography
                        variant="h3"
                        sx={{ fontWeight: 700, color: "#FFB74D" }}
                      >
                        {w.analytics.totalAppointments}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        All Time
                      </Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          )}
        </Grid>
      </Box>
    </Fade>
  );
};

export default DashboardPage;
