import React, { useEffect, useState } from "react";
import {
  Tabs,
  Tab,
  Box,
  Fade,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
} from "@mui/material";
import { People, TrendingUp, Dashboard } from "@mui/icons-material";
import ContactsTab from "../components/crm/ContactsTab";
import DealsTab from "../components/crm/DealsTab";
import DashboardTab from "../components/crm/DashboardTab";
import ContactProfileDrawer from "../components/crm/ContactProfileDrawer";
import { createContact, updateContact } from "../api/crm";
import api from "../api/client";
import type { Contact, LifecycleStage } from "../types/crm";
import { LIFECYCLE_STAGES } from "../types/crm";

// localStorage key for tab persistence
const CRM_TAB_KEY = "crm_active_tab";

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel({ children, value, index }: TabPanelProps) {
  return (
    <Box
      role="tabpanel"
      hidden={value !== index}
      id={`crm-tabpanel-${index}`}
      aria-labelledby={`crm-tab-${index}`}
      sx={{ flex: 1, minHeight: 0, overflow: "auto" }}
    >
      {value === index && <Box sx={{ height: "100%" }}>{children}</Box>}
    </Box>
  );
}

function a11yProps(index: number) {
  return {
    id: `crm-tab-${index}`,
    "aria-controls": `crm-tabpanel-${index}`,
  };
}

const LIFECYCLE_STAGE_LABELS: Record<LifecycleStage, string> = {
  lead: "Lead",
  prospect: "Prospect",
  customer: "Customer",
  vip: "VIP",
  churned: "Churned",
};

interface ContactForm {
  name: string;
  email: string;
  phone: string;
  company: string;
  jobTitle: string;
  leadSource: string;
  lifecycleStage: LifecycleStage;
  notes: string;
}

const emptyForm: ContactForm = {
  name: "",
  email: "",
  phone: "",
  company: "",
  jobTitle: "",
  leadSource: "",
  lifecycleStage: "lead",
  notes: "",
};

const CRMPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<number>(() => {
    const stored = localStorage.getItem(CRM_TAB_KEY);
    if (stored !== null) {
      const parsed = parseInt(stored, 10);
      if (parsed >= 0 && parsed <= 2) {
        return parsed;
      }
    }
    return 0;
  });

  // Profile drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedContactId, setSelectedContactId] = useState<string | null>(
    null,
  );

  // Edit/Create dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingContactId, setEditingContactId] = useState<string | null>(null);
  const [form, setForm] = useState<ContactForm>({ ...emptyForm });
  const [saving, setSaving] = useState(false);

  // Force refresh key for ContactsTab
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    localStorage.setItem(CRM_TAB_KEY, String(activeTab));
  }, [activeTab]);

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  // View contact profile
  const handleContactClick = (contact: Contact) => {
    setSelectedContactId(contact.id);
    setDrawerOpen(true);
  };

  const handleDrawerClose = () => {
    setDrawerOpen(false);
    setSelectedContactId(null);
  };

  // Open create dialog
  const handleAddContact = () => {
    setEditingContactId(null);
    setForm({ ...emptyForm });
    setDialogOpen(true);
  };

  // Open edit dialog (from profile drawer or elsewhere)
  const handleEditContact = (contact: Contact) => {
    setEditingContactId(contact.id);
    setForm({
      name: contact.name,
      email: contact.email || "",
      phone: contact.phone || "",
      company: contact.company || "",
      jobTitle: contact.jobTitle || "",
      leadSource: contact.leadSource || "",
      lifecycleStage: contact.lifecycleStage || "lead",
      notes: contact.notes || "",
    });
    setDialogOpen(true);
  };

  // Save contact (create or update)
  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const data = {
        name: form.name.trim(),
        email: form.email.trim() || undefined,
        phone: form.phone.trim() || undefined,
        company: form.company.trim() || undefined,
        jobTitle: form.jobTitle.trim() || undefined,
        leadSource: form.leadSource.trim() || undefined,
        lifecycleStage: form.lifecycleStage,
        notes: form.notes.trim() || undefined,
      };

      if (editingContactId) {
        await updateContact(editingContactId, data);
      } else {
        await createContact(data);
      }
      setDialogOpen(false);
      setForm({ ...emptyForm });
      setRefreshKey((k) => k + 1);
    } catch (error) {
      console.error("Failed to save contact:", error);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Fade in timeout={500}>
      <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
        <Box
          sx={{
            borderBottom: 1,
            borderColor: "divider",
            mb: 2,
          }}
        >
          <Tabs
            value={activeTab}
            onChange={handleTabChange}
            aria-label="CRM navigation tabs"
            sx={{
              "& .MuiTab-root": {
                textTransform: "none",
                fontWeight: 600,
                fontSize: "0.95rem",
                minHeight: 48,
                color: "text.secondary",
                "&.Mui-selected": {
                  color: "primary.main",
                },
              },
              "& .MuiTabs-indicator": {
                backgroundColor: "primary.main",
              },
            }}
          >
            <Tab
              icon={<People />}
              iconPosition="start"
              label="Contacts"
              {...a11yProps(0)}
            />
            <Tab
              icon={<TrendingUp />}
              iconPosition="start"
              label="Deals"
              {...a11yProps(1)}
            />
            <Tab
              icon={<Dashboard />}
              iconPosition="start"
              label="Dashboard"
              {...a11yProps(2)}
            />
          </Tabs>
        </Box>

        <TabPanel value={activeTab} index={0}>
          <ContactsTab
            key={refreshKey}
            onContactClick={handleContactClick}
            onAddContact={handleAddContact}
          />
        </TabPanel>

        <TabPanel value={activeTab} index={1}>
          <DealsTab />
        </TabPanel>

        <TabPanel value={activeTab} index={2}>
          <DashboardTab />
        </TabPanel>

        {/* Contact Profile Drawer */}
        <ContactProfileDrawer
          open={drawerOpen}
          contactId={selectedContactId}
          onClose={handleDrawerClose}
          onEditContact={handleEditContact}
          onCreateTask={async (contactId) => {
            const title = prompt("Task title:");
            if (!title) return;
            try {
              await api.post("/tasks", { title, contactId });
            } catch (e) {
              console.error("Failed to create task:", e);
            }
          }}
          onCreateAppointment={async (contactId) => {
            const title = prompt("Appointment title:");
            if (!title) return;
            const now = new Date();
            const start = new Date(now.getTime() + 24 * 60 * 60 * 1000);
            start.setHours(10, 0, 0, 0);
            const end = new Date(start.getTime() + 60 * 60 * 1000);
            try {
              await api.post(`/appointments/from-contact/${contactId}`, {
                title,
                startTime: start.toISOString(),
                endTime: end.toISOString(),
              });
            } catch (e) {
              console.error("Failed to create appointment:", e);
            }
          }}
        />

        {/* Create / Edit Contact Dialog */}
        <Dialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          aria-labelledby="contact-dialog-title"
          maxWidth="sm"
          fullWidth
        >
          <DialogTitle id="contact-dialog-title">
            {editingContactId ? "Edit Contact" : "Add Contact"}
          </DialogTitle>
          <DialogContent
            sx={{
              display: "flex",
              flexDirection: "column",
              gap: 2,
              pt: "16px !important",
            }}
          >
            <TextField
              label="Name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              fullWidth
              required
              size="small"
            />
            <Box sx={{ display: "flex", gap: 2 }}>
              <TextField
                label="Email"
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                fullWidth
                size="small"
              />
              <TextField
                label="Phone"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                fullWidth
                size="small"
              />
            </Box>
            <Box sx={{ display: "flex", gap: 2 }}>
              <TextField
                label="Company"
                value={form.company}
                onChange={(e) => setForm({ ...form, company: e.target.value })}
                fullWidth
                size="small"
              />
              <TextField
                label="Job Title"
                value={form.jobTitle}
                onChange={(e) => setForm({ ...form, jobTitle: e.target.value })}
                fullWidth
                size="small"
              />
            </Box>
            <Box sx={{ display: "flex", gap: 2 }}>
              <TextField
                label="Lead Source"
                value={form.leadSource}
                onChange={(e) =>
                  setForm({ ...form, leadSource: e.target.value })
                }
                fullWidth
                size="small"
              />
              <FormControl fullWidth size="small">
                <InputLabel id="lifecycle-stage-label">Lifecycle Stage</InputLabel>
                <Select
                  labelId="lifecycle-stage-label"
                  value={form.lifecycleStage}
                  label="Lifecycle Stage"
                  onChange={(e) =>
                    setForm({
                      ...form,
                      lifecycleStage: e.target.value as LifecycleStage,
                    })
                  }
                >
                  {LIFECYCLE_STAGES.map((stage) => (
                    <MenuItem key={stage} value={stage}>
                      {LIFECYCLE_STAGE_LABELS[stage]}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>
            <TextField
              label="Notes"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              multiline
              rows={3}
              fullWidth
              size="small"
            />
          </DialogContent>
          <DialogActions sx={{ p: 2 }}>
            <Button
              onClick={() => setDialogOpen(false)}
              sx={{ color: "text.secondary" }}
            >
              Cancel
            </Button>
            <Button
              variant="contained"
              onClick={handleSave}
              disabled={!form.name.trim() || saving}
            >
              {saving
                ? "Saving..."
                : editingContactId
                  ? "Save Changes"
                  : "Create Contact"}
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </Fade>
  );
};

export default CRMPage;
