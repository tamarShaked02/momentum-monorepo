import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Typography,
  TextField,
  IconButton,
  Card,
  CardContent,
  Button,
  Chip,
  CircularProgress,
  Fade,
} from "@mui/material";
import {
  Send,
  AutoAwesome,
  CheckCircle,
  Inventory2,
  CalendarMonth,
  People,
  Campaign,
  BarChart,
  CheckBox,
} from "@mui/icons-material";
import api from "../api/client";
import { useAuth } from "../contexts/AuthContext";
import type { ConversationMessage, OnboardingResponse } from "../types";

const moduleIcons: Record<string, React.ReactNode> = {
  scheduling: <CalendarMonth fontSize="small" />,
  crm: <People fontSize="small" />,
  inventory: <Inventory2 fontSize="small" />,
  tasks: <CheckBox fontSize="small" />,
  marketing: <Campaign fontSize="small" />,
  analytics: <BarChart fontSize="small" />,
};

const OnboardingPage: React.FC = () => {
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [recommendation, setRecommendation] =
    useState<OnboardingResponse | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [started, setStarted] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { refreshUser, user } = useAuth();

  // If user already has modules configured (returning user), auto-start
  const isReturning = !!user?.moduleConfig;

  useEffect(() => {
    if (isReturning && !started) {
      startOnboarding();
    }
  }, [isReturning]);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, loading]);

  const startOnboarding = async () => {
    setStarted(true);
    setLoading(true);
    try {
      const res = await api.post("/onboarding/start");
      const greeting = isReturning
        ? "Welcome back! Tell me what else you need — want to add a module, change your setup, or explore new features?"
        : res.data.message;
      setMessages([{ role: "assistant", content: greeting }]);
    } catch {
      const fallback = isReturning
        ? "Welcome back! What would you like to change about your setup? I can add new modules or reconfigure existing ones."
        : "Hi! I'm your Momentum assistant. Tell me about the business you're building — what do you do?";
      setMessages([{ role: "assistant", content: fallback }]);
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || loading) return;
    const userMsg: ConversationMessage = {
      role: "user",
      content: input.trim(),
    };
    const newHistory = [...messages, userMsg];
    setMessages(newHistory);
    setInput("");
    setLoading(true);

    try {
      const res = await api.post("/onboarding/message", {
        conversationHistory: newHistory,
      });
      const data: OnboardingResponse = res.data;

      if (data.type === "question") {
        setMessages([
          ...newHistory,
          { role: "assistant", content: data.message! },
        ]);
      } else if (data.type === "recommendation") {
        setMessages([
          ...newHistory,
          { role: "assistant", content: data.summary! },
        ]);
        // Infer mode from summary/context if not explicitly provided by AI
        if (!data.mode && isReturning) {
          const summaryLower = (data.summary || "").toLowerCase();
          const lastUserMsg = userMsg.content.toLowerCase();
          const removeIndicators = [
            "remove",
            "disable",
            "turn off",
            "don't want",
            "dont want",
            "no longer",
            "not want",
          ];
          const isRemove = removeIndicators.some(
            (k) => summaryLower.includes(k) || lastUserMsg.includes(k),
          );
          data.mode = isRemove ? "remove" : "add";
        }
        setRecommendation(data);
      }
    } catch {
      setMessages([
        ...newHistory,
        {
          role: "assistant",
          content:
            "I'm having trouble understanding. Could you describe your business in a bit more detail?",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const confirmSetup = async () => {
    if (!recommendation) return;
    setConfirming(true);
    try {
      // Use the mode from the AI recommendation, or default based on user state
      const mode = recommendation.mode || (isReturning ? "add" : "replace");
      await api.post("/onboarding/confirm", {
        recommended_modules: recommendation.recommended_modules,
        businessType: recommendation.businessType,
        mode,
      });
      await refreshUser();
      navigate("/dashboard");
    } catch {
      alert("Failed to save configuration. Please try again.");
    } finally {
      setConfirming(false);
    }
  };

  if (!started) {
    return (
      <Box
        sx={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background:
            "linear-gradient(145deg, #0a0e27 0%, #1a1f3a 50%, #0d1130 100%)",
          p: 2,
        }}
      >
        <Card sx={{ maxWidth: 520, width: "100%", p: 4, textAlign: "center" }}>
          <AutoAwesome sx={{ fontSize: 56, color: "#4FC3F7", mb: 2 }} />
          <Typography variant="h4" sx={{ mb: 1 }}>
            Let's set up your business
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
            Tell me about your business in your own words, and I'll
            automatically configure the perfect management tools for you.
          </Typography>
          <Button
            variant="contained"
            size="large"
            onClick={startOnboarding}
            sx={{ px: 6, py: 1.5 }}
          >
            Start Setup
          </Button>
        </Card>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        height: "100vh",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        background:
          "linear-gradient(145deg, #0a0e27 0%, #1a1f3a 50%, #0d1130 100%)",
      }}
    >
      {/* Header */}
      <Box
        sx={{
          p: 3,
          textAlign: "center",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
        }}
      >
        {isReturning && (
          <Button
            size="small"
            onClick={() => navigate("/settings")}
            sx={{
              position: "absolute",
              left: 16,
              color: "text.secondary",
              textTransform: "none",
            }}
          >
            ← Back
          </Button>
        )}
        <Box>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1,
              justifyContent: "center",
            }}
          >
            <AutoAwesome sx={{ color: "#4FC3F7" }} />
            <Typography variant="h5" fontWeight={700}>
              {isReturning ? "Reconfigure Modules" : "Momentum Setup"}
            </Typography>
          </Box>
          <Typography variant="body2" color="text.secondary">
            {isReturning
              ? "Tell me what modules you'd like to add or change"
              : "Describe your business and I'll do the rest"}
          </Typography>
        </Box>
      </Box>

      {/* Chat Area */}
      <Box
        ref={scrollRef}
        sx={{
          flexGrow: 1,
          overflow: "auto",
          px: { xs: 2, sm: 4 },
          py: 3,
          maxWidth: 700,
          mx: "auto",
          width: "100%",
        }}
      >
        {messages.map((msg, i) => (
          <Fade in key={i} timeout={400}>
            <Box
              sx={{
                display: "flex",
                justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
                mb: 2,
              }}
            >
              <Box
                sx={{
                  maxWidth: "80%",
                  px: 2.5,
                  py: 1.5,
                  borderRadius:
                    msg.role === "user"
                      ? "18px 18px 4px 18px"
                      : "18px 18px 18px 4px",
                  background:
                    msg.role === "user"
                      ? "linear-gradient(135deg, #4FC3F7 0%, #0288D1 100%)"
                      : "rgba(255,255,255,0.06)",
                  color: msg.role === "user" ? "#fff" : "#E8EAED",
                  border:
                    msg.role === "user"
                      ? "none"
                      : "1px solid rgba(255,255,255,0.08)",
                }}
              >
                <Typography variant="body1" sx={{ lineHeight: 1.6 }}>
                  {msg.content}
                </Typography>
              </Box>
            </Box>
          </Fade>
        ))}

        {loading && (
          <Box sx={{ display: "flex", gap: 1, alignItems: "center", mb: 2 }}>
            <Box
              sx={{
                px: 2.5,
                py: 1.5,
                borderRadius: "18px 18px 18px 4px",
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <Box sx={{ display: "flex", gap: 0.5, alignItems: "center" }}>
                {[0, 1, 2].map((i) => (
                  <Box
                    key={i}
                    sx={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: "#4FC3F7",
                      animation: "bounce 1.2s infinite",
                      animationDelay: `${i * 0.2}s`,
                      "@keyframes bounce": {
                        "0%, 80%, 100%": { transform: "translateY(0)" },
                        "40%": { transform: "translateY(-8px)" },
                      },
                    }}
                  />
                ))}
              </Box>
            </Box>
          </Box>
        )}

        {/* Module Recommendations */}
        {recommendation && (
          <Fade in timeout={600}>
            <Card
              sx={{
                mt: 2,
                p: 2,
                border: "1px solid rgba(79,195,247,0.3)",
                background: "rgba(79,195,247,0.05)",
              }}
            >
              <CardContent>
                <Typography
                  variant="h6"
                  fontWeight={600}
                  sx={{ mb: 2, display: "flex", alignItems: "center", gap: 1 }}
                >
                  <CheckCircle sx={{ color: "#66BB6A" }} /> Recommended Modules
                </Typography>
                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mb: 3 }}>
                  {recommendation.recommended_modules?.map((mod) => (
                    <Chip
                      key={mod.id}
                      icon={moduleIcons[mod.id] as any}
                      label={mod.id.charAt(0).toUpperCase() + mod.id.slice(1)}
                      sx={{
                        background: "rgba(79,195,247,0.15)",
                        color: "#4FC3F7",
                        fontWeight: 600,
                        border: "1px solid rgba(79,195,247,0.3)",
                      }}
                    />
                  ))}
                </Box>
                {recommendation.recommended_modules?.map((mod) => (
                  <Typography
                    key={mod.id}
                    variant="body2"
                    color="text.secondary"
                    sx={{ mb: 0.5 }}
                  >
                    • <strong>{mod.id}</strong>: {mod.reason}
                  </Typography>
                ))}
                <Button
                  fullWidth
                  variant="contained"
                  size="large"
                  onClick={confirmSetup}
                  disabled={confirming}
                  sx={{ mt: 3, py: 1.5 }}
                >
                  {confirming ? (
                    <CircularProgress size={24} />
                  ) : isReturning ? (
                    recommendation?.mode === "remove" ? (
                      "Remove These Modules ✕"
                    ) : (
                      "Add These Modules ✓"
                    )
                  ) : (
                    "Let's Go! 🚀"
                  )}
                </Button>
              </CardContent>
            </Card>
          </Fade>
        )}
      </Box>

      {/* Input Area */}
      {!recommendation && (
        <Box
          sx={{
            p: 2,
            borderTop: "1px solid rgba(255,255,255,0.06)",
            maxWidth: 700,
            mx: "auto",
            width: "100%",
          }}
        >
          <Box
            component="form"
            onSubmit={(e: React.FormEvent) => {
              e.preventDefault();
              sendMessage();
            }}
            sx={{ display: "flex", gap: 1, alignItems: "center" }}
          >
            <TextField
              fullWidth
              placeholder="Describe your business..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              disabled={loading}
              autoFocus
              variant="outlined"
              size="small"
              sx={{ "& .MuiOutlinedInput-root": { borderRadius: 6, pr: 1 } }}
            />
            <IconButton
              type="submit"
              disabled={!input.trim() || loading}
              sx={{
                background: "linear-gradient(135deg, #4FC3F7, #0288D1)",
                color: "#fff",
                "&:hover": {
                  background: "linear-gradient(135deg, #80D8FF, #4FC3F7)",
                },
                "&:disabled": { opacity: 0.4 },
              }}
            >
              <Send />
            </IconButton>
          </Box>
        </Box>
      )}
    </Box>
  );
};

export default OnboardingPage;
