import React, { useEffect, useState, useCallback } from "react";
import {
  Box,
  Typography,
  Fade,
  Skeleton,
  Button,
  TextField,
  Divider,
  Switch,
  useTheme,
  Avatar,
} from "@mui/material";
import {
  Settings,
  Google,
  LinkOff,
  Person,
  Lock,
  Notifications,
  Save,
} from "@mui/icons-material";
import api from "../api/client";
import { useAuth } from "../contexts/AuthContext";
import { useSnackbar } from "../contexts/SnackbarContext";
import type { GoogleCalendarStatus } from "../types";
import IntegrationCard from "../components/settings/IntegrationCard";

const SettingsPage: React.FC = () => {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const { user } = useAuth();
  const { showSuccess, showError } = useSnackbar();

  // Google Calendar state
  const [googleStatus, setGoogleStatus] = useState<GoogleCalendarStatus | null>(
    null,
  );
  const [loading, setLoading] = useState(true);

  // Profile form
  const [businessName, setBusinessName] = useState(user?.businessName || "");
  const [email] = useState(user?.email || "");
  const [profileSaving, setProfileSaving] = useState(false);

  // Password form
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);

  // Notification preferences (local UI — can be wired to backend later)
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [appointmentReminders, setAppointmentReminders] = useState(true);
  const [syncAlerts, setSyncAlerts] = useState(true);

  const fetchStatus = useCallback(() => {
    api
      .get("/google-calendar/status")
      .then((res) => {
        setGoogleStatus(res.data);
        setLoading(false);
      })
      .catch(() => {
        setGoogleStatus(null);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  useEffect(() => {
    if (user?.businessName) setBusinessName(user.businessName);
  }, [user]);

  const handleConnect = async () => {
    try {
      const res = await api.get("/google-calendar/auth-url");
      window.location.href = res.data.url;
    } catch {
      showError("Failed to initiate Google Calendar connection");
    }
  };

  const handleDisconnect = async () => {
    try {
      await api.delete("/google-calendar/disconnect");
      setGoogleStatus({
        connected: false,
        email: null,
        lastSyncAt: null,
        error: null,
      });
      showSuccess("Google Calendar disconnected");
    } catch {
      showError("Failed to disconnect Google Calendar");
    }
  };

  const handleProfileSave = async () => {
    setProfileSaving(true);
    try {
      await api.put("/auth/profile", { businessName });
      showSuccess("Profile updated");
    } catch {
      showError("Failed to update profile");
    } finally {
      setProfileSaving(false);
    }
  };

  const handlePasswordChange = async () => {
    if (newPassword !== confirmPassword) {
      showError("Passwords don't match");
      return;
    }
    if (newPassword.length < 6) {
      showError("Password must be at least 6 characters");
      return;
    }
    setPasswordSaving(true);
    try {
      await api.put("/auth/password", { currentPassword, newPassword });
      showSuccess("Password changed successfully");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch {
      showError("Failed to change password — check your current password");
    } finally {
      setPasswordSaving(false);
    }
  };

  const sectionStyle = {
    p: 3,
    borderRadius: "16px",
    background: isDark ? "rgba(26, 31, 58, 0.7)" : "#ffffff",
    backdropFilter: isDark ? "blur(12px)" : "none",
    border: isDark ? "1px solid rgba(255,255,255,0.08)" : "1px solid #e5e5ea",
    boxShadow: isDark ? "none" : "0 1px 3px rgba(0,0,0,0.06)",
  };

  return (
    <Fade in timeout={500}>
      <Box sx={{ maxWidth: 720 }}>
        {/* Page Header */}
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 1 }}>
          <Settings sx={{ color: "#4FC3F7", fontSize: 32 }} />
          <Typography variant="h4">Settings</Typography>
        </Box>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
          Manage your profile, security, and integrations.
        </Typography>

        <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
          {/* Profile Section */}
          <Box sx={sectionStyle}>
            <Box
              sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 2.5 }}
            >
              <Person sx={{ color: "#4FC3F7", fontSize: 20 }} />
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                Profile
              </Typography>
            </Box>

            <Box
              sx={{ display: "flex", alignItems: "center", gap: 2.5, mb: 3 }}
            >
              <Avatar
                sx={{
                  width: 56,
                  height: 56,
                  background: "linear-gradient(135deg, #4FC3F7, #0288D1)",
                  fontSize: 22,
                  fontWeight: 700,
                }}
              >
                {businessName?.[0]?.toUpperCase() ||
                  email?.[0]?.toUpperCase() ||
                  "M"}
              </Avatar>
              <Box>
                <Typography variant="body1" sx={{ fontWeight: 600 }}>
                  {businessName || "My Business"}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {email}
                </Typography>
              </Box>
            </Box>

            <TextField
              label="Business Name"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              fullWidth
              size="small"
              sx={{ mb: 2 }}
            />
            <TextField
              label="Email"
              value={email}
              disabled
              fullWidth
              size="small"
              sx={{ mb: 2.5 }}
              helperText="Email cannot be changed"
            />
            <Button
              variant="contained"
              size="small"
              startIcon={<Save sx={{ fontSize: 16 }} />}
              onClick={handleProfileSave}
              disabled={profileSaving}
              sx={{ borderRadius: "10px", px: 3 }}
            >
              {profileSaving ? "Saving..." : "Save Changes"}
            </Button>
          </Box>

          {/* Security Section */}
          <Box sx={sectionStyle}>
            <Box
              sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 2.5 }}
            >
              <Lock sx={{ color: "#FFB74D", fontSize: 20 }} />
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                Security
              </Typography>
            </Box>

            <TextField
              label="Current Password"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              fullWidth
              size="small"
              sx={{ mb: 2 }}
            />
            <Box sx={{ display: "flex", gap: 2, mb: 2.5 }}>
              <TextField
                label="New Password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                fullWidth
                size="small"
              />
              <TextField
                label="Confirm Password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                fullWidth
                size="small"
              />
            </Box>
            <Button
              variant="outlined"
              size="small"
              startIcon={<Lock sx={{ fontSize: 16 }} />}
              onClick={handlePasswordChange}
              disabled={passwordSaving || !currentPassword || !newPassword}
              sx={{ borderRadius: "10px", px: 3 }}
            >
              {passwordSaving ? "Changing..." : "Change Password"}
            </Button>
          </Box>

          {/* Notifications Section */}
          <Box sx={sectionStyle}>
            <Box
              sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 2 }}
            >
              <Notifications sx={{ color: "#66BB6A", fontSize: 20 }} />
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                Notifications
              </Typography>
            </Box>

            <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5 }}>
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  py: 1,
                }}
              >
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>
                    Email notifications
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Receive updates about your business via email
                  </Typography>
                </Box>
                <Switch
                  checked={emailNotifications}
                  onChange={(_, v) => setEmailNotifications(v)}
                  color="primary"
                />
              </Box>
              <Divider
                sx={{
                  borderColor: isDark ? "rgba(255,255,255,0.04)" : "#f0f0f0",
                }}
              />
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  py: 1,
                }}
              >
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>
                    Appointment reminders
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Get notified before upcoming appointments
                  </Typography>
                </Box>
                <Switch
                  checked={appointmentReminders}
                  onChange={(_, v) => setAppointmentReminders(v)}
                  color="primary"
                />
              </Box>
              <Divider
                sx={{
                  borderColor: isDark ? "rgba(255,255,255,0.04)" : "#f0f0f0",
                }}
              />
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  py: 1,
                }}
              >
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>
                    Sync alerts
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Notify when Google Calendar sync encounters issues
                  </Typography>
                </Box>
                <Switch
                  checked={syncAlerts}
                  onChange={(_, v) => setSyncAlerts(v)}
                  color="primary"
                />
              </Box>
            </Box>
          </Box>

          {/* Integrations Section */}
          <Box>
            <Typography
              variant="overline"
              sx={{
                letterSpacing: 1.5,
                fontSize: "0.7rem",
                color: "text.secondary",
                mb: 2,
                display: "block",
              }}
            >
              Integrations
            </Typography>

            <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {loading ? (
                <Skeleton
                  variant="rounded"
                  height={120}
                  sx={{ borderRadius: 4 }}
                />
              ) : (
                <IntegrationCard
                  icon={<Google />}
                  title="Google Calendar"
                  description="Sync your appointments to Google Calendar. Events appear under a calendar named after your business."
                  connected={googleStatus?.connected ?? false}
                >
                  {googleStatus?.connected ? (
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 2,
                        flexWrap: "wrap",
                      }}
                    >
                      <Typography
                        variant="body2"
                        sx={{
                          color: isDark ? "#E8EAED" : "#1a1a1a",
                          fontWeight: 500,
                          background: isDark
                            ? "rgba(255,255,255,0.04)"
                            : "rgba(0,0,0,0.03)",
                          px: 1.5,
                          py: 0.5,
                          borderRadius: "8px",
                          fontSize: "0.85rem",
                        }}
                      >
                        {googleStatus.email}
                      </Typography>
                      {googleStatus.lastSyncAt && (
                        <Typography variant="caption" color="text.secondary">
                          Last sync:{" "}
                          {new Date(googleStatus.lastSyncAt).toLocaleString()}
                        </Typography>
                      )}
                      <Button
                        size="small"
                        startIcon={<LinkOff sx={{ fontSize: 16 }} />}
                        onClick={handleDisconnect}
                        sx={{
                          ml: "auto",
                          color: "#FF6B6B",
                          fontSize: "0.8rem",
                          textTransform: "none",
                          borderRadius: "8px",
                          "&:hover": { background: "rgba(255, 107, 107, 0.1)" },
                        }}
                      >
                        Disconnect
                      </Button>
                    </Box>
                  ) : (
                    <Button
                      variant="outlined"
                      startIcon={<Google />}
                      onClick={handleConnect}
                      sx={{
                        borderColor: isDark
                          ? "rgba(255,255,255,0.12)"
                          : "#d1d1d6",
                        color: isDark ? "#E8EAED" : "#1a1a1a",
                        borderRadius: "12px",
                        textTransform: "none",
                        fontSize: "0.85rem",
                        fontWeight: 500,
                        px: 3,
                        "&:hover": {
                          borderColor: "rgba(79, 195, 247, 0.5)",
                          background: "rgba(79, 195, 247, 0.08)",
                        },
                      }}
                    >
                      Connect Google Calendar
                    </Button>
                  )}
                </IntegrationCard>
              )}

              <IntegrationCard
                icon={
                  <Box
                    sx={{
                      width: 24,
                      height: 24,
                      borderRadius: "6px",
                      background: isDark
                        ? "rgba(255,255,255,0.1)"
                        : "rgba(0,0,0,0.06)",
                    }}
                  />
                }
                title="More coming soon"
                description="Additional integrations like WhatsApp, Stripe, and more will appear here."
              >
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ fontStyle: "italic" }}
                >
                  Stay tuned for updates
                </Typography>
              </IntegrationCard>
            </Box>
          </Box>
        </Box>
      </Box>
    </Fade>
  );
};

export default SettingsPage;
