import React, { useState, useEffect } from "react";
import {
  Box,
  Typography,
  TextField,
  Button,
  Card,
  CardContent,
  Chip,
  ToggleButton,
  ToggleButtonGroup,
  Fade,
  CircularProgress,
  Divider,
  Tab,
  Tabs,
  IconButton,
  MenuItem,
  Select,
} from "@mui/material";
import {
  Campaign,
  AutoAwesome,
  Sms,
  Email,
  Share,
  Delete,
} from "@mui/icons-material";
import api from "../api/client";
import { useSnackbar } from "../contexts/SnackbarContext";
import type { MarketingCampaign } from "../types";

const goalLabels: Record<string, string> = {
  fill_schedule: "📅 Fill Empty Slots",
  promote_product: "🎁 Promote Product",
  general_update: "📢 General Update",
};

const MarketingPage: React.FC = () => {
  const [tab, setTab] = useState(0);
  const [step, setStep] = useState(0);
  const [goal, setGoal] = useState("");
  const [brief, setBrief] = useState("");
  const [channels, setChannels] = useState<string[]>(["sms", "social"]);
  const [content, setContent] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [campaignName, setCampaignName] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [campaigns, setCampaigns] = useState<MarketingCampaign[]>([]);
  const [campaignsLoading, setCampaignsLoading] = useState(false);
  const { showError, showConfirm } = useSnackbar();

  const goals = [
    { value: "fill_schedule", label: "Fill Empty Slots", emoji: "📅" },
    { value: "promote_product", label: "Promote Product", emoji: "🎁" },
    { value: "general_update", label: "General Update", emoji: "📢" },
  ];

  const fetchCampaigns = () => {
    setCampaignsLoading(true);
    api
      .get("/marketing/automations")
      .then((res) => setCampaigns(res.data))
      .catch(() => {})
      .finally(() => setCampaignsLoading(false));
  };

  useEffect(() => {
    if (tab === 1) fetchCampaigns();
    const handleRefresh = () => fetchCampaigns();
    window.addEventListener("ai_mutation_success", handleRefresh);
    window.addEventListener("marketing-updated", handleRefresh);
    window.addEventListener("data-updated", handleRefresh);
    return () => {
      window.removeEventListener("ai_mutation_success", handleRefresh);
      window.removeEventListener("marketing-updated", handleRefresh);
      window.removeEventListener("data-updated", handleRefresh);
    };
  }, [tab]);

  const handleGenerate = async () => {
    if (!brief.trim()) return;
    setLoading(true);
    try {
      const res = await api.post("/marketing/generate", {
        brief: `Goal: ${goal}. ${brief}`,
        channels,
      });
      setContent(res.data);
      setStep(2);
    } catch {
      showError("Failed to generate content.");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.post("/marketing/automations", {
        name: campaignName || `Campaign - ${new Date().toLocaleDateString()}`,
        goal,
        channels,
        smsContent: content?.sms || null,
        emailContent:
          typeof content?.email === "object"
            ? `${content.email.subject}\n\n${content.email.body}`
            : content?.email || null,
        socialContent: content?.social || null,
      });
      setSaved(true);
    } catch {
      showError("Failed to save campaign.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    const confirmed = await showConfirm("Delete this campaign?");
    if (!confirmed) return;
    await api.delete(`/marketing/automations/${id}`);
    fetchCampaigns();
  };

  const handleStatusChange = async (id: string, status: string) => {
    await api.put(`/marketing/automations/${id}`, { status });
    setCampaigns((prev) =>
      prev.map((c) => (c.id === id ? { ...c, status } : c)),
    );
  };

  const statusColor: Record<string, string> = {
    draft: "#FFB74D",
    active: "#66BB6A",
    completed: "#4FC3F7",
    paused: "#9AA0B4",
  };

  return (
    <Fade in timeout={500}>
      <Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 3 }}>
          <Campaign sx={{ color: "#FF7043", fontSize: 32 }} />
          <Typography variant="h4">Marketing</Typography>
        </Box>

        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          sx={{ mb: 3, borderBottom: "1px solid rgba(255,255,255,0.06)" }}
        >
          <Tab label="Campaign Wizard" />
          <Tab label="My Campaigns" />
        </Tabs>

        {/* ── Wizard Tab ── */}
        {tab === 0 && (
          <Box>
            <Box sx={{ display: "flex", gap: 2, mb: 4 }}>
              {["Select Goal", "Create Content", "Review & Launch"].map(
                (s, i) => (
                  <Chip
                    key={i}
                    label={s}
                    sx={{
                      background:
                        step >= i
                          ? "rgba(79,195,247,0.15)"
                          : "rgba(255,255,255,0.03)",
                      color: step >= i ? "#4FC3F7" : "text.secondary",
                      fontWeight: step === i ? 700 : 400,
                      border:
                        step === i
                          ? "1px solid rgba(79,195,247,0.4)"
                          : "1px solid rgba(255,255,255,0.06)",
                    }}
                  />
                ),
              )}
            </Box>

            {step === 0 && (
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: { xs: "1fr", sm: "repeat(3, 1fr)" },
                  gap: 2,
                }}
              >
                {goals.map((g) => (
                  <Card
                    key={g.value}
                    onClick={() => {
                      setGoal(g.value);
                      setStep(1);
                    }}
                    sx={{
                      cursor: "pointer",
                      textAlign: "center",
                      py: 4,
                      border: "1px solid rgba(255,255,255,0.08)",
                      "&:hover": {
                        borderColor: "rgba(79,195,247,0.4)",
                        transform: "translateY(-4px)",
                      },
                    }}
                  >
                    <Typography variant="h3" sx={{ mb: 1 }}>
                      {g.emoji}
                    </Typography>
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>
                      {g.label}
                    </Typography>
                  </Card>
                ))}
              </Box>
            )}

            {step === 1 && (
              <Box sx={{ maxWidth: 600 }}>
                <Card sx={{ p: 3, mb: 3 }}>
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      gap: 1,
                      mb: 2,
                    }}
                  >
                    <AutoAwesome sx={{ color: "#4FC3F7" }} />
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>
                      Describe Your Campaign
                    </Typography>
                  </Box>
                  <TextField
                    fullWidth
                    multiline
                    rows={3}
                    placeholder='e.g., "20% off all services this Friday, targeting regular customers"'
                    value={brief}
                    onChange={(e) => setBrief(e.target.value)}
                    sx={{ mb: 3 }}
                  />
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>
                    Channels
                  </Typography>
                  <ToggleButtonGroup
                    value={channels}
                    onChange={(_, v) => {
                      if (v.length) setChannels(v);
                    }}
                    sx={{ mb: 3 }}
                  >
                    <ToggleButton value="sms" sx={{ gap: 0.5 }}>
                      <Sms fontSize="small" /> SMS
                    </ToggleButton>
                    <ToggleButton value="email" sx={{ gap: 0.5 }}>
                      <Email fontSize="small" /> Email
                    </ToggleButton>
                    <ToggleButton value="social" sx={{ gap: 0.5 }}>
                      <Share fontSize="small" /> Social
                    </ToggleButton>
                  </ToggleButtonGroup>
                  <Box sx={{ display: "flex", gap: 2 }}>
                    <Button variant="outlined" onClick={() => setStep(0)}>
                      Back
                    </Button>
                    <Button
                      variant="contained"
                      onClick={handleGenerate}
                      disabled={loading || !brief.trim()}
                      startIcon={
                        loading ? (
                          <CircularProgress size={16} />
                        ) : (
                          <AutoAwesome />
                        )
                      }
                    >
                      {loading ? "Generating..." : "Generate Content"}
                    </Button>
                  </Box>
                </Card>
              </Box>
            )}

            {step === 2 && content && (
              <Box>
                <Box
                  sx={{
                    display: "grid",
                    gridTemplateColumns: { xs: "1fr", md: "repeat(2, 1fr)" },
                    gap: 3,
                    mb: 3,
                  }}
                >
                  {channels.includes("sms") && content.sms && (
                    <Card sx={{ border: "1px solid rgba(255,183,77,0.3)" }}>
                      <CardContent>
                        <Box
                          sx={{
                            display: "flex",
                            alignItems: "center",
                            gap: 1,
                            mb: 2,
                          }}
                        >
                          <Sms sx={{ color: "#FFB74D" }} />
                          <Typography variant="h6" sx={{ fontWeight: 600 }}>
                            SMS
                          </Typography>
                        </Box>
                        <Typography
                          variant="body2"
                          sx={{
                            p: 2,
                            background: "rgba(255,255,255,0.03)",
                            borderRadius: 2,
                            fontStyle: "italic",
                          }}
                        >
                          {content.sms}
                        </Typography>
                      </CardContent>
                    </Card>
                  )}
                  {channels.includes("email") && content.email && (
                    <Card sx={{ border: "1px solid rgba(79,195,247,0.3)" }}>
                      <CardContent>
                        <Box
                          sx={{
                            display: "flex",
                            alignItems: "center",
                            gap: 1,
                            mb: 2,
                          }}
                        >
                          <Email sx={{ color: "#4FC3F7" }} />
                          <Typography variant="h6" sx={{ fontWeight: 600 }}>
                            Email
                          </Typography>
                        </Box>
                        <Typography
                          variant="subtitle2"
                          sx={{ mb: 1, color: "#4FC3F7" }}
                        >
                          Subject:{" "}
                          {typeof content.email === "object"
                            ? content.email.subject
                            : ""}
                        </Typography>
                        <Typography
                          variant="body2"
                          sx={{
                            p: 2,
                            background: "rgba(255,255,255,0.03)",
                            borderRadius: 2,
                            whiteSpace: "pre-wrap",
                          }}
                        >
                          {typeof content.email === "object"
                            ? content.email.body
                            : content.email}
                        </Typography>
                      </CardContent>
                    </Card>
                  )}
                  {channels.includes("social") && content.social && (
                    <Card
                      sx={{
                        border: "1px solid rgba(186,104,200,0.3)",
                        gridColumn: channels.length < 3 ? "auto" : "1 / -1",
                      }}
                    >
                      <CardContent>
                        <Box
                          sx={{
                            display: "flex",
                            alignItems: "center",
                            gap: 1,
                            mb: 2,
                          }}
                        >
                          <Share sx={{ color: "#BA68C8" }} />
                          <Typography variant="h6" sx={{ fontWeight: 600 }}>
                            Social Media
                          </Typography>
                        </Box>
                        <Typography
                          variant="body2"
                          sx={{
                            p: 2,
                            background: "rgba(255,255,255,0.03)",
                            borderRadius: 2,
                            whiteSpace: "pre-wrap",
                          }}
                        >
                          {content.social}
                        </Typography>
                      </CardContent>
                    </Card>
                  )}
                </Box>

                <Divider
                  sx={{ borderColor: "rgba(255,255,255,0.06)", my: 3 }}
                />

                {!saved ? (
                  <Box sx={{ display: "flex", gap: 2, alignItems: "center" }}>
                    <TextField
                      label="Campaign Name"
                      value={campaignName}
                      onChange={(e) => setCampaignName(e.target.value)}
                      size="small"
                      sx={{ minWidth: 250 }}
                    />
                    <Button
                      variant="outlined"
                      onClick={() => {
                        setStep(1);
                        setContent(null);
                      }}
                    >
                      Regenerate
                    </Button>
                    <Button
                      variant="contained"
                      onClick={handleSave}
                      disabled={saving}
                      size="large"
                    >
                      {saving ? "Saving..." : "🚀 Save Campaign"}
                    </Button>
                  </Box>
                ) : (
                  <Card
                    sx={{
                      p: 3,
                      background: "rgba(102,187,106,0.08)",
                      border: "1px solid rgba(102,187,106,0.3)",
                      textAlign: "center",
                    }}
                  >
                    <Typography variant="h6" sx={{ color: "#66BB6A" }}>
                      ✅ Campaign saved successfully!
                    </Typography>
                    <Box
                      sx={{
                        display: "flex",
                        gap: 2,
                        justifyContent: "center",
                        mt: 2,
                      }}
                    >
                      <Button
                        onClick={() => {
                          setStep(0);
                          setContent(null);
                          setSaved(false);
                          setBrief("");
                          setCampaignName("");
                        }}
                      >
                        Create Another
                      </Button>
                      <Button
                        variant="outlined"
                        onClick={() => {
                          setTab(1);
                        }}
                      >
                        View Campaigns
                      </Button>
                    </Box>
                  </Card>
                )}
              </Box>
            )}
          </Box>
        )}

        {/* ── Campaigns Tab ── */}
        {tab === 1 && (
          <Box>
            {campaignsLoading ? (
              <Box sx={{ display: "flex", justifyContent: "center", pt: 6 }}>
                <CircularProgress />
              </Box>
            ) : campaigns.length === 0 ? (
              <Box sx={{ textAlign: "center", pt: 8 }}>
                <Typography variant="h6" color="text.secondary">
                  No campaigns yet
                </Typography>
                <Button
                  sx={{ mt: 2 }}
                  variant="contained"
                  onClick={() => setTab(0)}
                >
                  Create your first campaign
                </Button>
              </Box>
            ) : (
              <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                {campaigns.map((c) => (
                  <Card
                    key={c.id}
                    sx={{ border: "1px solid rgba(255,255,255,0.08)" }}
                  >
                    <CardContent>
                      <Box
                        sx={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "flex-start",
                        }}
                      >
                        <Box sx={{ flex: 1 }}>
                          <Box
                            sx={{
                              display: "flex",
                              alignItems: "center",
                              gap: 1.5,
                              mb: 1,
                            }}
                          >
                            <Typography variant="h6" sx={{ fontWeight: 600 }}>
                              {c.name}
                            </Typography>
                            <Select
                              value={c.status}
                              size="small"
                              onChange={(e) =>
                                handleStatusChange(c.id, e.target.value)
                              }
                              sx={{
                                minWidth: 120,
                                height: 28,
                                fontSize: "0.75rem",
                                fontWeight: 600,
                                textTransform: "capitalize",
                                color: statusColor[c.status] ?? "#999",
                                "& .MuiOutlinedInput-notchedOutline": {
                                  borderColor: `${statusColor[c.status] ?? "#999"}44`,
                                },
                                "&:hover .MuiOutlinedInput-notchedOutline": {
                                  borderColor: statusColor[c.status] ?? "#999",
                                },
                              }}
                            >
                              <MenuItem value="draft">Draft</MenuItem>
                              <MenuItem value="active">Active</MenuItem>
                              <MenuItem value="completed">Completed</MenuItem>
                            </Select>
                          </Box>
                          {c.goal && (
                            <Typography
                              variant="body2"
                              color="text.secondary"
                              sx={{ mb: 1 }}
                            >
                              {goalLabels[c.goal] ?? c.goal}
                            </Typography>
                          )}
                          <Box
                            sx={{
                              display: "flex",
                              gap: 1,
                              flexWrap: "wrap",
                              mb: 1.5,
                            }}
                          >
                            {c.channels.map((ch) => (
                              <Chip
                                key={ch}
                                label={ch.toUpperCase()}
                                size="small"
                                variant="outlined"
                                sx={{
                                  borderColor: "rgba(255,255,255,0.15)",
                                  fontSize: "0.7rem",
                                }}
                              />
                            ))}
                          </Box>
                          {c.smsContent && (
                            <Box sx={{ mb: 1 }}>
                              <Typography
                                variant="caption"
                                sx={{ color: "#FFB74D", fontWeight: 600 }}
                              >
                                SMS
                              </Typography>
                              <Typography
                                variant="body2"
                                sx={{
                                  p: 1.5,
                                  mt: 0.5,
                                  background: "rgba(255,255,255,0.03)",
                                  borderRadius: 2,
                                  fontStyle: "italic",
                                }}
                              >
                                {c.smsContent}
                              </Typography>
                            </Box>
                          )}
                          {c.emailContent && (
                            <Box sx={{ mb: 1 }}>
                              <Typography
                                variant="caption"
                                sx={{ color: "#4FC3F7", fontWeight: 600 }}
                              >
                                EMAIL
                              </Typography>
                              <Typography
                                variant="body2"
                                sx={{
                                  p: 1.5,
                                  mt: 0.5,
                                  background: "rgba(255,255,255,0.03)",
                                  borderRadius: 2,
                                  whiteSpace: "pre-wrap",
                                }}
                              >
                                {c.emailContent}
                              </Typography>
                            </Box>
                          )}
                          {c.socialContent && (
                            <Box>
                              <Typography
                                variant="caption"
                                sx={{ color: "#BA68C8", fontWeight: 600 }}
                              >
                                SOCIAL
                              </Typography>
                              <Typography
                                variant="body2"
                                sx={{
                                  p: 1.5,
                                  mt: 0.5,
                                  background: "rgba(255,255,255,0.03)",
                                  borderRadius: 2,
                                  whiteSpace: "pre-wrap",
                                }}
                              >
                                {c.socialContent}
                              </Typography>
                            </Box>
                          )}
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{ mt: 1, display: "block" }}
                          >
                            Created {new Date(c.createdAt).toLocaleDateString()}
                          </Typography>
                        </Box>
                        <IconButton
                          onClick={() => handleDelete(c.id)}
                          sx={{ color: "#FF6B6B", ml: 1 }}
                        >
                          <Delete />
                        </IconButton>
                      </Box>
                    </CardContent>
                  </Card>
                ))}
              </Box>
            )}
          </Box>
        )}
      </Box>
    </Fade>
  );
};

export default MarketingPage;
