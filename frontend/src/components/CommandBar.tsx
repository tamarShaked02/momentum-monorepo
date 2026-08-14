import React, { useState } from "react";
import {
  AppBar,
  Toolbar,
  IconButton,
  InputBase,
  Box,
  Snackbar,
  Alert,
  Typography,
  useMediaQuery,
  useTheme,
  Chip,
} from "@mui/material";
import { Menu as MenuIcon, AutoAwesome } from "@mui/icons-material";
import api from "../api/client";

interface CommandBarProps {
  onMenuClick: () => void;
}

const CommandBar: React.FC<CommandBarProps> = ({ onMenuClick }) => {
  const [command, setCommand] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    type: string;
    message?: string;
  } | null>(null);
  const [showResult, setShowResult] = useState(false);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  const isFallbackOrError = (resData: any) => {
    if (!resData || resData.success === false || resData.type === "error" || resData.type === "unknown") {
      return true;
    }
    const msg = resData.message || "";
    return (
      msg.includes("high demand") ||
      msg.includes("experiencing exceptionally high demand") ||
      msg.includes("try your request again")
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!command.trim() || loading) return;

    setLoading(true);
    try {
      const res = await api.post("/ai/command", { command: command.trim() });
      const failed = isFallbackOrError(res.data);
      const formattedResult = {
        ...res.data,
        success: !failed && Boolean(res.data?.success),
        type: failed ? "error" : (res.data?.type || "result"),
      };

      setResult(formattedResult);
      setShowResult(true);
      setCommand("");

      if (!failed && res.data?.success) {
        window.dispatchEvent(new CustomEvent("permissions_updated", { detail: res.data }));
        window.dispatchEvent(new CustomEvent("ai_mutation_success", { detail: res.data }));
        window.dispatchEvent(new Event("inventory-updated"));
        window.dispatchEvent(new Event("crm-updated"));
        window.dispatchEvent(new Event("deals-updated"));
        window.dispatchEvent(new Event("tasks-updated"));
        window.dispatchEvent(new Event("appointments-updated"));
        window.dispatchEvent(new Event("marketing-updated"));
        window.dispatchEvent(new Event("data-updated"));
      }
    } catch {
      setResult({ success: false, type: "error", message: "Failed to process command." });
      setShowResult(true);
    } finally {
      setLoading(false);
    }
  };

  const getResultMessage = () => {
    if (!result) return "";
    if (isFallbackOrError(result)) {
      return result.message || "Something went wrong.";
    }
    if (result.type === "clarification") {
      return `💬 ${result.message}`;
    }
    return `✅ ${result.message || "Action completed successfully"}`;
  };

  return (
    <>
      <AppBar
        position="fixed"
        sx={{
          ml: isMobile ? 0 : "260px",
          width: isMobile ? "100%" : "calc(100% - 260px)",
        }}
      >
        <Toolbar sx={{ gap: 1 }}>
          {isMobile && (
            <IconButton onClick={onMenuClick} sx={{ color: "text.primary" }}>
              <MenuIcon />
            </IconButton>
          )}

          <Box
            component="form"
            onSubmit={handleSubmit}
            sx={{
              display: "flex",
              alignItems: "center",
              flexGrow: 1,
              gap: 1,
              background: "rgba(255,255,255,0.05)",
              borderRadius: 3,
              px: 2,
              py: 0.5,
              border: "1px solid rgba(255,255,255,0.08)",
              transition: "all 0.2s",
              "&:focus-within": {
                border: "1px solid rgba(79,195,247,0.4)",
                background: "rgba(255,255,255,0.07)",
              },
            }}
          >
            <AutoAwesome sx={{ color: "#4FC3F7", fontSize: 20 }} />
            <InputBase
              placeholder={
                isMobile
                  ? "Ask AI..."
                  : 'Ask AI anything... "Book Lisa for tomorrow at 2pm"'
              }
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              sx={{
                flexGrow: 1,
                color: "text.primary",
                fontSize: "0.9rem",
                "& ::placeholder": { color: "#9AA0B4", opacity: 1 },
              }}
              disabled={loading}
            />
            {loading && (
              <Chip
                label="Thinking..."
                size="small"
                sx={{
                  background: "rgba(79,195,247,0.2)",
                  color: "#4FC3F7",
                  fontSize: "0.75rem",
                }}
              />
            )}
          </Box>
        </Toolbar>
      </AppBar>

      <Snackbar
        open={showResult}
        autoHideDuration={4000}
        onClose={() => setShowResult(false)}
        anchorOrigin={{ vertical: "top", horizontal: "center" }}
      >
        <Alert
          onClose={() => setShowResult(false)}
          severity={
            result?.type === "error" || result?.type === "unknown" || !result?.success
              ? "warning"
              : "success"
          }
          variant="filled"
          sx={{ borderRadius: 3, backdropFilter: "blur(10px)" }}
        >
          <Typography variant="body2">{getResultMessage()}</Typography>
        </Alert>
      </Snackbar>
    </>
  );
};

export default CommandBar;
