import React, { useEffect, useState, useCallback, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Box, Typography, Fade } from "@mui/material";
import { CalendarMonth } from "@mui/icons-material";
import api from "../api/client";
import { useSnackbar } from "../contexts/SnackbarContext";
import type { Appointment, GoogleCalendarStatus } from "../types";
import CustomCalendar from "../components/calendar/CustomCalendar";
import AppointmentDialog from "../components/calendar/AppointmentDialog";
import type { AppointmentFormData } from "../components/calendar/AppointmentDialog";
import ExternalEventPopover from "../components/calendar/ExternalEventPopover";
import ReminderBanner from "../components/calendar/ReminderBanner";
import SyncStatusIndicator from "../components/calendar/SyncStatusIndicator";

const AppointmentsPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [customers, setCustomers] = useState<Array<{ id: string; name: string }>>([]);
  const [googleStatus, setGoogleStatus] = useState<GoogleCalendarStatus | null>(null);
  const { showSuccess, showError } = useSnackbar();

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create");
  const [dialogInitialData, setDialogInitialData] = useState<
    Partial<AppointmentFormData> | undefined
  >(undefined);
  const [editingAppointmentId, setEditingAppointmentId] = useState<string | null>(null);

  // External event popover state
  const [popoverAppointment, setPopoverAppointment] = useState<Appointment | null>(null);
  const [popoverAnchorEl, setPopoverAnchorEl] = useState<HTMLElement | null>(null);

  // Track current visible range for refetching
  const currentRangeRef = useRef<{ start: string; end: string } | null>(null);

  // Fetch customers on mount
  useEffect(() => {
    api
      .get("/customers", { params: { pageSize: 1000 } })
      .then((res) => {
        const customerList = res.data.data || res.data;
        setCustomers(
          customerList.map((c: { id: string; name: string }) => ({
            id: c.id,
            name: c.name,
          }))
        );
      })
      .catch((e) => {
        console.error("Failed to load customers:", e);
      });
  }, []);

  // Fetch Google Calendar status
  const fetchGoogleStatus = useCallback(() => {
    api
      .get("/google-calendar/status")
      .then((res) => setGoogleStatus(res.data))
      .catch(() => setGoogleStatus(null));
  }, []);

  useEffect(() => {
    fetchGoogleStatus();
  }, [fetchGoogleStatus]);

  // Handle OAuth redirect back from Google
  useEffect(() => {
    const googleConnected = searchParams.get("google_connected");
    const googleError = searchParams.get("google_error");

    if (googleConnected === "true") {
      showSuccess("Google Calendar connected successfully");
      fetchGoogleStatus();
      setSearchParams({}, { replace: true });
    } else if (googleError) {
      const errorMessages: Record<string, string> = {
        denied: "Google Calendar access was denied",
        no_code: "OAuth authorization code missing",
        no_state: "OAuth state missing — please try again",
        invalid_state: "OAuth session expired — please try again",
        token_failed: "Failed to get tokens from Google",
        server_error: "Server error during connection",
      };
      showError(
        errorMessages[googleError] || "Failed to connect Google Calendar",
      );
      setSearchParams({}, { replace: true });
    }
  }, [
    searchParams,
    setSearchParams,
    showSuccess,
    showError,
    fetchGoogleStatus,
  ]);

  // Fetch appointments for visible range
  const fetchAppointments = useCallback(
    (startDate: string, endDate: string) => {
      api
        .get("/appointments", { params: { startDate, endDate } })
        .then((res) => setAppointments(res.data))
        .catch(() => showError("Failed to load appointments"));
    },
    [showError],
  );

  // Range change callback from CustomCalendar
  const handleRangeChange = useCallback(
    (start: string, end: string) => {
      currentRangeRef.current = { start, end };
      fetchAppointments(start, end);
    },
    [fetchAppointments],
  );

  // Refetch current range helper
  const refetchCurrentRange = useCallback(() => {
    if (currentRangeRef.current) {
      fetchAppointments(
        currentRangeRef.current.start,
        currentRangeRef.current.end,
      );
    }
  }, [fetchAppointments]);

  // Auto-sync polling: every 60 seconds when connected
  useEffect(() => {
    if (!googleStatus?.connected) return;

    const intervalId = setInterval(() => {
      api
        .post("/google-calendar/sync")
        .then(() => {
          fetchGoogleStatus();
          refetchCurrentRange();
        })
        .catch(() => {
          fetchGoogleStatus();
        });
    }, 60000);

    return () => clearInterval(intervalId);
  }, [googleStatus?.connected, fetchGoogleStatus, refetchCurrentRange]);

  const openAppointmentDetails = useCallback(
    (appointment: Appointment, targetEl?: HTMLElement) => {
      const isExternal = appointment.source === "google_calendar";

      if (isExternal) {
        setPopoverAppointment(appointment);
        if (targetEl) setPopoverAnchorEl(targetEl);
      } else {
        setDialogMode("edit");
        setDialogInitialData({
          title: appointment.title,
          customerId: appointment.customerId ?? null,
          startTime: formatDateTimeLocal(new Date(appointment.startTime)),
          endTime: formatDateTimeLocal(new Date(appointment.endTime)),
          status: appointment.status,
          source: appointment.source,
          price: appointment.price,
          notes: appointment.notes,
        });
        setEditingAppointmentId(appointment.id);
        setDialogOpen(true);
      }
    },
    [],
  );

  // Slot click callback from CustomCalendar
  const handleSlotClick = useCallback(
    (startDate: Date, endDate: Date) => {
      setDialogMode("create");
      setDialogInitialData({
        startTime: formatDateTimeLocal(startDate),
        endTime: formatDateTimeLocal(endDate),
      });
      setEditingAppointmentId(null);
      setDialogOpen(true);
    },
    [],
  );

  // Dialog save handler
  const handleDialogSave = async (data: AppointmentFormData) => {
    try {
      if (dialogMode === "create") {
        await api.post("/appointments", {
          ...data,
          startTime: new Date(data.startTime).toISOString(),
          endTime: new Date(data.endTime).toISOString(),
        });
        showSuccess("Appointment created");
      } else if (editingAppointmentId) {
        await api.put(`/appointments/${editingAppointmentId}`, {
          ...data,
          startTime: new Date(data.startTime).toISOString(),
          endTime: new Date(data.endTime).toISOString(),
        });
        showSuccess("Appointment updated");
      }
      setDialogOpen(false);
      refetchCurrentRange();
    } catch {
      showError("Failed to save appointment");
    }
  };

  // Dialog delete handler
  const handleDialogDelete = async () => {
    if (!editingAppointmentId) return;
    try {
      await api.delete(`/appointments/${editingAppointmentId}`);
      showSuccess("Appointment deleted");
      setDialogOpen(false);
      refetchCurrentRange();
    } catch {
      showError("Failed to delete appointment");
    }
  };

  // Manual sync
  const handleManualSync = async () => {
    try {
      await api.post("/google-calendar/sync");
      showSuccess("Sync complete");
      fetchGoogleStatus();
      refetchCurrentRange();
    } catch {
      showError("Sync failed");
    }
  };

  return (
    <Fade in timeout={500}>
      <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
        {/* Header area */}
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            mb: 2,
            flexWrap: "wrap",
            gap: 1,
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <CalendarMonth sx={{ color: "#4FC3F7", fontSize: 32 }} />
            <Typography variant="h4" sx={{ fontWeight: 700 }}>
              Calendar
            </Typography>
          </Box>

          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 2,
              flexWrap: "wrap",
            }}
          >
            {googleStatus?.connected && (
              <SyncStatusIndicator
                lastSyncAt={googleStatus.lastSyncAt}
                syncError={googleStatus.error}
                onManualSync={handleManualSync}
              />
            )}
          </Box>
        </Box>

        {/* Reminder Banner for users who haven't connected Google Calendar */}
        {googleStatus && !googleStatus.connected && !googleStatus.error && (
          <ReminderBanner onNavigateToSettings={() => navigate("/settings")} />
        )}

        {/* Custom Momentum Calendar */}
        <Box sx={{ flex: 1, minHeight: 0 }}>
          <CustomCalendar
            appointments={appointments}
            onRangeChange={handleRangeChange}
            onSlotClick={handleSlotClick}
            onAppointmentClick={openAppointmentDetails}
            initialView="week"
          />
        </Box>

        {/* Appointment Dialog */}
        <AppointmentDialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          onSave={handleDialogSave}
          onDelete={dialogMode === "edit" ? handleDialogDelete : undefined}
          initialData={dialogInitialData}
          mode={dialogMode}
          customers={customers}
        />

        {/* External Event Popover */}
        {popoverAppointment && (
          <ExternalEventPopover
            appointment={popoverAppointment}
            anchorEl={popoverAnchorEl}
            onClose={() => {
              setPopoverAppointment(null);
              setPopoverAnchorEl(null);
            }}
          />
        )}
      </Box>
    </Fade>
  );
};

// Helper: format Date to datetime-local input value
function formatDateTimeLocal(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

export default AppointmentsPage;
