import React, { useEffect, useState, useCallback, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Box, Typography, Fade } from "@mui/material";
import { CalendarMonth } from "@mui/icons-material";
import FullCalendar from "@fullcalendar/react";
import "../components/calendar/calendarStyles.css";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import type {
  EventContentArg,
  DatesSetArg,
  DateSelectArg,
  EventClickArg,
  EventDropArg,
} from "@fullcalendar/core";
import type { EventResizeDoneArg } from "@fullcalendar/interaction";
import api from "../api/client";
import { useSnackbar } from "../contexts/SnackbarContext";
import { useThemeMode } from "../contexts/ThemeContext";
import type { Appointment, GoogleCalendarStatus } from "../types";
import EventCard from "../components/calendar/EventCard";
import AppointmentDialog from "../components/calendar/AppointmentDialog";
import type { AppointmentFormData } from "../components/calendar/AppointmentDialog";
import ExternalEventPopover from "../components/calendar/ExternalEventPopover";
import ReminderBanner from "../components/calendar/ReminderBanner";
import SyncStatusIndicator from "../components/calendar/SyncStatusIndicator";

const AppointmentsPage: React.FC = () => {
  const { mode } = useThemeMode();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [customers, setCustomers] = useState<
    Array<{ id: string; name: string }>
  >([]);
  const [googleStatus, setGoogleStatus] = useState<GoogleCalendarStatus | null>(
    null,
  );
  const { showSuccess, showError } = useSnackbar();

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create");
  const [dialogInitialData, setDialogInitialData] = useState<
    Partial<AppointmentFormData> | undefined
  >(undefined);
  const [editingAppointmentId, setEditingAppointmentId] = useState<
    string | null
  >(null);

  // External event popover state
  const [popoverAppointment, setPopoverAppointment] =
    useState<Appointment | null>(null);
  const [popoverAnchorEl, setPopoverAnchorEl] = useState<HTMLElement | null>(
    null,
  );

  // Track current visible range for refetching
  const currentRangeRef = useRef<{ start: string; end: string } | null>(null);
  const calendarRef = useRef<FullCalendar | null>(null);

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
      // Clean up URL params
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

  // FullCalendar datesSet callback - fires when visible range changes
  const handleDatesSet = useCallback(
    (arg: DatesSetArg) => {
      const start = arg.startStr.slice(0, 10);
      const end = arg.endStr.slice(0, 10);
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
          // Refresh status to surface any token errors
          fetchGoogleStatus();
        });
    }, 60000);

    return () => clearInterval(intervalId);
  }, [googleStatus?.connected, fetchGoogleStatus, refetchCurrentRange]);

  // Map appointments to FullCalendar events
  const calendarEvents = appointments.map((appt) => ({
    id: appt.id,
    title: appt.title,
    start: appt.startTime,
    end: appt.endTime,
    editable: appt.source !== "google_calendar",
    extendedProps: { appointment: appt },
  }));

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

  // Custom event content renderer
  const renderEventContent = (eventInfo: EventContentArg) => {
    const appointment = eventInfo.event.extendedProps?.appointment as
      | Appointment
      | undefined;
    if (!appointment) return null;
    const isExternal = appointment.source === "google_calendar";
    return (
      <EventCard
        appointment={appointment}
        isExternal={isExternal}
        isDraggable={!isExternal}
        onClick={(appt) => openAppointmentDetails(appt)}
      />
    );
  };

  // dateClick: open create dialog with pre-filled time
  const handleDateClick = useCallback(
    (arg: { date: Date; dateStr: string; allDay: boolean }) => {
      const clickedDate = arg.date;
      const startTime = formatDateTimeLocal(clickedDate);
      const endTime = formatDateTimeLocal(
        new Date(clickedDate.getTime() + 60 * 60 * 1000),
      );

      setDialogMode("create");
      setDialogInitialData({
        startTime,
        endTime,
      });
      setEditingAppointmentId(null);
      setDialogOpen(true);
    },
    [],
  );

  // select: open create dialog with selected range
  const handleSelect = useCallback((arg: DateSelectArg) => {
    const startTime = formatDateTimeLocal(arg.start);
    const endTime = formatDateTimeLocal(arg.end);

    setDialogMode("create");
    setDialogInitialData({
      startTime,
      endTime,
    });
    setEditingAppointmentId(null);
    setDialogOpen(true);

    // Unselect
    const calendarApi = arg.view.calendar;
    calendarApi.unselect();
  }, []);

  // eventClick: open edit dialog (local) or popover (external)
  const handleEventClick = useCallback((arg: EventClickArg) => {
    const appointment = arg.event.extendedProps.appointment as Appointment;
    const isExternal = appointment.source === "google_calendar";

    if (isExternal) {
      setPopoverAppointment(appointment);
      setPopoverAnchorEl(arg.el);
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
  }, []);

  // eventDrop: drag-and-drop rescheduling
  const handleEventDrop = useCallback(
    async (arg: EventDropArg) => {
      const appointment = arg.event.extendedProps.appointment as Appointment;
      const newStart = arg.event.start;
      const newEnd = arg.event.end;

      if (!newStart || !newEnd) {
        arg.revert();
        return;
      }

      try {
        await api.put(`/appointments/${appointment.id}`, {
          startTime: newStart.toISOString(),
          endTime: newEnd.toISOString(),
        });
        showSuccess("Appointment rescheduled");
        refetchCurrentRange();
      } catch {
        arg.revert();
        showError("Failed to reschedule appointment");
      }
    },
    [showSuccess, showError, refetchCurrentRange],
  );

  // eventResize: resize rescheduling
  const handleEventResize = useCallback(
    async (arg: EventResizeDoneArg) => {
      const appointment = arg.event.extendedProps.appointment as Appointment;
      const newStart = arg.event.start;
      const newEnd = arg.event.end;

      if (!newStart || !newEnd) {
        arg.revert();
        return;
      }

      try {
        await api.put(`/appointments/${appointment.id}`, {
          startTime: newStart.toISOString(),
          endTime: newEnd.toISOString(),
        });
        showSuccess("Appointment updated");
        refetchCurrentRange();
      } catch {
        arg.revert();
        showError("Failed to update appointment");
      }
    },
    [showSuccess, showError, refetchCurrentRange],
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

  // moreLinkContent for month view "+N more" overflow
  const moreLinkContent = (arg: { num: number }) => {
    return `+${arg.num} more`;
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
            <Typography variant="h4">Calendar</Typography>
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

        {/* Calendar */}
        <Box
          className={mode === "dark" ? "calendar-dark" : "calendar-light"}
          sx={{
            flex: 1,
            minHeight: 0,
            "& .fc": {
              height: "100%",
              fontFamily: "inherit",
            },
            "& .fc-toolbar-title": {
              fontSize: "1.2rem !important",
              fontWeight: 600,
              color: mode === "dark" ? "#E8EAED" : "#1a1a1a",
            },
            "& .fc-button": {
              background:
                mode === "dark"
                  ? "rgba(26, 31, 58, 0.7) !important"
                  : "#ffffff !important",
              border:
                mode === "dark"
                  ? "1px solid rgba(255,255,255,0.12) !important"
                  : "1px solid #d1d1d6 !important",
              color:
                mode === "dark" ? "#E8EAED !important" : "#1a1a1a !important",
              borderRadius: "8px !important",
              fontSize: "0.85rem !important",
              padding: "6px 14px !important",
              textTransform: "capitalize",
              transition: "all 0.2s ease",
              "&:hover": {
                background:
                  mode === "dark"
                    ? "rgba(79, 195, 247, 0.15) !important"
                    : "rgba(79, 195, 247, 0.08) !important",
                borderColor: "rgba(79, 195, 247, 0.4) !important",
              },
            },
            "& .fc-button-active": {
              background:
                mode === "dark"
                  ? "rgba(79, 195, 247, 0.25) !important"
                  : "rgba(79, 195, 247, 0.15) !important",
              borderColor: "#4FC3F7 !important",
              color: "#4FC3F7 !important",
            },
            "& .fc-scrollgrid": {
              borderColor:
                mode === "dark"
                  ? "rgba(255,255,255,0.06) !important"
                  : "#e5e5ea !important",
            },
            "& .fc-scrollgrid td, & .fc-scrollgrid th": {
              borderColor:
                mode === "dark"
                  ? "rgba(255,255,255,0.06) !important"
                  : "#e5e5ea !important",
            },
            "& .fc-timegrid-slot": {
              height: "48px !important",
            },
            "& .fc-timegrid-slot-label": {
              color: mode === "dark" ? "#9AA0B4" : "#6e6e73",
              fontSize: "0.75rem",
            },
            "& .fc-col-header-cell": {
              background: mode === "dark" ? "rgba(26, 31, 58, 0.5)" : "#f5f5f7",
              borderColor:
                mode === "dark"
                  ? "rgba(255,255,255,0.06) !important"
                  : "#e5e5ea !important",
              padding: "8px 0",
            },
            "& .fc-col-header-cell-cushion": {
              color: mode === "dark" ? "#9AA0B4" : "#6e6e73",
              fontWeight: 500,
              fontSize: "0.85rem",
              textDecoration: "none",
            },
            "& .fc-daygrid-day-number": {
              color: mode === "dark" ? "#9AA0B4" : "#6e6e73",
              textDecoration: "none",
              fontSize: "0.85rem",
              padding: "4px 8px",
            },
            "& .fc-day-today": {
              background:
                mode === "dark"
                  ? "rgba(79, 195, 247, 0.04) !important"
                  : "rgba(79, 195, 247, 0.06) !important",
            },
            "& .fc-timegrid-now-indicator-line": {
              borderColor: "#4FC3F7 !important",
              borderWidth: "2px !important",
            },
            "& .fc-timegrid-now-indicator-arrow": {
              borderColor: "#4FC3F7 !important",
              color: "#4FC3F7 !important",
            },
            "& .fc-event": {
              background: "transparent !important",
              border: "none !important",
              boxShadow: "none !important",
              cursor: "pointer",
            },
            "& .fc-event-main": {
              padding: 0,
            },
            "& .fc-more-link": {
              color: "#4FC3F7 !important",
              fontWeight: 600,
              fontSize: "0.8rem",
            },
            "& .fc-highlight": {
              background:
                mode === "dark"
                  ? "rgba(79, 195, 247, 0.08) !important"
                  : "rgba(79, 195, 247, 0.12) !important",
            },
            "& .fc-popover": {
              background:
                mode === "dark"
                  ? "rgba(26, 31, 58, 0.95) !important"
                  : "#ffffff !important",
              border:
                mode === "dark"
                  ? "1px solid rgba(255,255,255,0.1) !important"
                  : "1px solid #e5e5ea !important",
              borderRadius: "12px !important",
            },
            "& .fc-popover-header": {
              background:
                mode === "dark"
                  ? "rgba(26, 31, 58, 0.9) !important"
                  : "#f5f5f7 !important",
              color:
                mode === "dark" ? "#E8EAED !important" : "#1a1a1a !important",
            },
          }}
        >
          {/* @ts-expect-error FullCalendar class component incompatible with React 19 JSX types */}
          <FullCalendar
            ref={calendarRef}
            plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
            initialView="timeGridWeek"
            headerToolbar={{
              left: "prev,next today",
              center: "title",
              right: "timeGridDay,timeGridWeek,dayGridMonth",
            }}
            nowIndicator={true}
            editable={true}
            selectable={true}
            selectMirror={true}
            dayMaxEvents={3}
            events={calendarEvents}
            eventContent={renderEventContent}
            datesSet={handleDatesSet}
            dateClick={handleDateClick}
            select={handleSelect}
            eventClick={handleEventClick}
            eventDrop={handleEventDrop}
            eventResize={handleEventResize}
            moreLinkContent={moreLinkContent}
            slotMinTime="06:00:00"
            slotMaxTime="22:00:00"
            allDaySlot={false}
            slotDuration="00:30:00"
            businessHours={{
              daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
              startTime: "08:00",
              endTime: "18:00",
            }}
            height="100%"
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
