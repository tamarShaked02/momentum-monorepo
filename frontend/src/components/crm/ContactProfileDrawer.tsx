import React, { useCallback, useEffect, useState } from "react";
import {
  Avatar,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Paper,
  Typography,
} from "@mui/material";
import {
  Close,
  Edit,
  Email,
  Phone,
  Work,
  Source,
  CalendarToday,
  Add,
  Assignment,
  AttachMoney,
  Campaign,
  ShoppingBag,
  Lightbulb,
  ErrorOutlined,
  Refresh,
  Telegram,
  Handshake,
} from "@mui/icons-material";
import {
  getContact,
  getContactTasks,
  getContactDeals,
  getContactCampaigns,
  getContactSuggestion,
} from "../../api/crm";
import type {
  Contact,
  ContactTag,
  CustomFieldValue,
  Deal,
  DealItem,
  LifecycleStage,
  AISuggestion,
} from "../../types/crm";
import ActivityTimeline from "./ActivityTimeline";
import InlineNoteComposer from "./InlineNoteComposer";
import TagManager from "./TagManager";

// --- Types ---

interface ContactWithMetrics extends Contact {
  revenueMetrics?: {
    totalRevenue: number;
    appointmentRevenue: number;
    dealRevenue: number;
    completedAppointments: number;
  };
}

interface LinkedTask {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueDate: string | null;
}

interface MarketingCampaign {
  id: string;
  name: string;
  status: string;
  scheduledAt: string | null;
}

interface PurchaseHistoryItem {
  dealId: string;
  dealTitle: string;
  closedAt: string;
  items: {
    name: string;
    quantity: number;
    unitPrice: number;
  }[];
}

export interface ContactProfileDrawerProps {
  open: boolean;
  contactId: string | null;
  onClose: () => void;
  onEditContact?: (contact: Contact) => void;
  onCreateAppointment?: (contactId: string) => void;
  onCreateTask?: (contactId: string) => void;
}

// --- Constants ---

const DRAWER_WIDTH = 480;

const LIFECYCLE_STAGE_LABELS: Record<LifecycleStage, string> = {
  lead: "Lead",
  prospect: "Prospect",
  customer: "Customer",
  vip: "VIP",
  churned: "Churned",
};

const LIFECYCLE_STAGE_COLORS: Record<LifecycleStage, string> = {
  lead: "#4FC3F7",
  prospect: "#FFB74D",
  customer: "#66BB6A",
  vip: "#AB47BC",
  churned: "#FF6B6B",
};

const PRIORITY_COLORS: Record<string, string> = {
  high: "error",
  medium: "warning",
  low: "info",
};

// --- Helpers ---

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString();
}

// --- Component ---

/**
 * ContactProfileDrawer – a slide-out panel showing the enriched contact profile.
 * Displays contact info, lifecycle stage, tags, revenue metrics, activity timeline,
 * linked tasks, deals, purchase history, AI suggestions, and marketing campaigns.
 *
 * Validates: Requirements 1.4, 1.7, 4.3, 8.3, 8.4, 9.5, 10.5, 12.1, 12.7, 12.8, 13.2
 */
const ContactProfileDrawer: React.FC<ContactProfileDrawerProps> = ({
  open,
  contactId,
  onClose,
  onEditContact,
  onCreateAppointment,
  onCreateTask,
}) => {
  const [contact, setContact] = useState<ContactWithMetrics | null>(null);
  const [tasks, setTasks] = useState<LinkedTask[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [campaigns, setCampaigns] = useState<MarketingCampaign[]>([]);
  const [suggestion, setSuggestion] = useState<AISuggestion | null>(null);
  const [suggestionError, setSuggestionError] = useState(false);
  const [loading, setLoading] = useState(false);
  const [suggestionLoading, setSuggestionLoading] = useState(false);

  // Fetch all contact data
  const fetchContactData = useCallback(async (id: string) => {
    setLoading(true);
    setSuggestion(null);
    setSuggestionError(false);

    try {
      const [contactData, tasksData, dealsData, campaignsData] =
        await Promise.all([
          getContact(id),
          getContactTasks(id),
          getContactDeals(id),
          getContactCampaigns(id),
        ]);

      setContact(contactData as ContactWithMetrics);
      setTasks(
        ((tasksData as LinkedTask[]) || []).sort((a, b) => {
          if (!a.dueDate && !b.dueDate) return 0;
          if (!a.dueDate) return 1;
          if (!b.dueDate) return -1;
          return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
        }),
      );
      setDeals((dealsData as Deal[]) || []);
      setCampaigns((campaignsData as MarketingCampaign[]) || []);
    } catch (error) {
      console.error("Failed to fetch contact data:", error);
    } finally {
      setLoading(false);
    }

    // Fetch AI suggestion separately (may be slower or fail)
    fetchSuggestion(id);
  }, []);

  const fetchSuggestion = async (id: string) => {
    setSuggestionLoading(true);
    setSuggestionError(false);
    try {
      const data = await getContactSuggestion(id);
      setSuggestion(data);
    } catch {
      setSuggestionError(true);
      setSuggestion(null);
    } finally {
      setSuggestionLoading(false);
    }
  };

  useEffect(() => {
    if (open && contactId) {
      fetchContactData(contactId);
    }
    if (!open) {
      setContact(null);
      setTasks([]);
      setDeals([]);
      setCampaigns([]);
      setSuggestion(null);
      setSuggestionError(false);
    }
  }, [open, contactId, fetchContactData]);

  const handleTagsChanged = () => {
    if (contactId) {
      getContact(contactId).then((data) =>
        setContact(data as ContactWithMetrics),
      );
    }
  };

  const handleNoteCreated = () => {
    // ActivityTimeline will auto-refresh via its own fetching
  };

  // Build purchase history from won deals
  const purchaseHistory: PurchaseHistoryItem[] = deals
    .filter((d) => d.status === "won" && d.closedAt)
    .sort(
      (a, b) =>
        new Date(b.closedAt!).getTime() - new Date(a.closedAt!).getTime(),
    )
    .filter((d) => d.items && d.items.length > 0)
    .map((d) => ({
      dealId: d.id,
      dealTitle: d.title,
      closedAt: d.closedAt!,
      items: (d.items || []).map((item: DealItem) => ({
        name: item.inventoryItem?.name || "Unknown Item",
        quantity: item.quantity,
        unitPrice: item.unitPrice,
      })),
    }));

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      sx={{
        "& .MuiDrawer-paper": {
          width: DRAWER_WIDTH,
          maxWidth: "100vw",
          bgcolor: "background.default",
        },
      }}
    >
      {/* Loading State */}
      {loading && (
        <Box
          sx={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            height: "100%",
          }}
        >
          <CircularProgress />
        </Box>
      )}

      {/* Content */}
      {!loading && contact && (
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            height: "100%",
            overflow: "auto",
          }}
        >
          {/* Header */}
          <Box
            sx={{
              p: 3,
              pb: 2,
              display: "flex",
              alignItems: "flex-start",
              gap: 2,
              bgcolor: "background.paper",
              borderBottom: 1,
              borderColor: "divider",
              position: "sticky",
              top: 0,
              zIndex: 1,
            }}
          >
            <Avatar
              sx={{
                width: 56,
                height: 56,
                bgcolor: "primary.main",
                fontSize: "1.25rem",
                fontWeight: 600,
              }}
            >
              {getInitials(contact.name)}
            </Avatar>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography
                variant="h6"
                sx={{ fontWeight: 600, color: "text.primary" }}
                noWrap
              >
                {contact.name}
              </Typography>
              {(contact.company || contact.jobTitle) && (
                <Typography
                  variant="body2"
                  sx={{ color: "text.secondary" }}
                  noWrap
                >
                  {[contact.jobTitle, contact.company]
                    .filter(Boolean)
                    .join(" at ")}
                </Typography>
              )}
              <Chip
                label={
                  LIFECYCLE_STAGE_LABELS[contact.lifecycleStage] ||
                  contact.lifecycleStage
                }
                size="small"
                sx={{
                  mt: 0.5,
                  bgcolor: `${LIFECYCLE_STAGE_COLORS[contact.lifecycleStage]}22`,
                  color:
                    LIFECYCLE_STAGE_COLORS[contact.lifecycleStage] ||
                    "text.primary",
                  border: `1px solid ${LIFECYCLE_STAGE_COLORS[contact.lifecycleStage]}44`,
                  fontWeight: 500,
                }}
              />
            </Box>
            {onEditContact && (
              <IconButton
                onClick={() => onEditContact(contact)}
                size="small"
                aria-label="Edit contact"
                sx={{ color: "text.secondary" }}
              >
                <Edit />
              </IconButton>
            )}
            <IconButton
              onClick={onClose}
              size="small"
              aria-label="Close drawer"
              sx={{ color: "text.secondary" }}
            >
              <Close />
            </IconButton>
          </Box>

          {/* Body */}
          <Box sx={{ p: 3, display: "flex", flexDirection: "column", gap: 3 }}>
            {/* Contact Info */}
            <Section title="Contact Info">
              <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
                {contact.email && (
                  <InfoRow
                    icon={<Email fontSize="small" />}
                    label="Email"
                    value={contact.email}
                  />
                )}
                {contact.phone && (
                  <InfoRow
                    icon={<Phone fontSize="small" />}
                    label="Phone"
                    value={contact.phone}
                  />
                )}
                {contact.telegramChatId && (
                  <InfoRow
                    icon={<Telegram fontSize="small" />}
                    label="Telegram"
                    value={contact.telegramChatId}
                  />
                )}
                {contact.jobTitle && (
                  <InfoRow
                    icon={<Work fontSize="small" />}
                    label="Job Title"
                    value={contact.jobTitle}
                  />
                )}
                {contact.leadSource && (
                  <InfoRow
                    icon={<Source fontSize="small" />}
                    label="Lead Source"
                    value={contact.leadSource}
                  />
                )}
              </Box>
            </Section>

            {/* Custom Fields */}
            {contact.customFieldValues &&
              contact.customFieldValues.length > 0 && (
                <Section title="Custom Fields">
                  <Box
                    sx={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 1,
                    }}
                  >
                    {contact.customFieldValues.map((cfv: CustomFieldValue) => (
                      <Box
                        key={cfv.id}
                        sx={{
                          display: "flex",
                          justifyContent: "space-between",
                        }}
                      >
                        <Typography
                          variant="body2"
                          sx={{ color: "text.secondary" }}
                        >
                          {cfv.customField?.name || "Field"}
                        </Typography>
                        <Typography
                          variant="body2"
                          sx={{
                            color: "text.primary",
                            fontWeight: 500,
                          }}
                        >
                          {cfv.value}
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                </Section>
              )}

            {/* Tags */}
            <Section title="Tags">
              <TagManager
                contactId={contact.id}
                tags={(contact.tags as ContactTag[]) || []}
                onTagsChanged={handleTagsChanged}
              />
            </Section>

            {/* Revenue Metrics */}
            <Section title="Revenue Metrics">
              <Box
                sx={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 1.5,
                }}
              >
                <MetricCard
                  label="Total Revenue"
                  value={formatCurrency(
                    contact.revenueMetrics?.totalRevenue || 0,
                  )}
                  icon={<AttachMoney />}
                />
                <MetricCard
                  label="Appointment Revenue"
                  value={formatCurrency(
                    contact.revenueMetrics?.appointmentRevenue || 0,
                  )}
                  icon={<CalendarToday />}
                />
                <MetricCard
                  label="Deal Revenue"
                  value={formatCurrency(
                    contact.revenueMetrics?.dealRevenue || 0,
                  )}
                  icon={<Handshake />}
                />
                <MetricCard
                  label="Completed Appointments"
                  value={String(
                    contact.revenueMetrics?.completedAppointments || 0,
                  )}
                  icon={<CalendarToday />}
                />
              </Box>
            </Section>

            {/* Activity Timeline with InlineNoteComposer */}
            <Section title="Activity">
              <InlineNoteComposer
                contactId={contact.id}
                onNoteCreated={handleNoteCreated}
              />
              <ActivityTimeline contactId={contact.id} />
            </Section>

            {/* Linked Tasks */}
            <Section title="Linked Tasks">
              {tasks.length === 0 ? (
                <Typography variant="body2" sx={{ color: "text.secondary" }}>
                  No linked tasks.
                </Typography>
              ) : (
                <List dense disablePadding>
                  {tasks.map((task) => (
                    <ListItem
                      key={task.id}
                      disablePadding
                      sx={{
                        py: 0.75,
                        borderBottom: 1,
                        borderColor: "divider",
                        "&:last-child": { borderBottom: 0 },
                      }}
                    >
                      <ListItemIcon sx={{ minWidth: 32 }}>
                        <Assignment
                          fontSize="small"
                          sx={{ color: "text.secondary" }}
                        />
                      </ListItemIcon>
                      <ListItemText
                        primary={task.title}
                        secondary={
                          <Box
                            component="span"
                            sx={{
                              display: "flex",
                              gap: 1,
                              alignItems: "center",
                              mt: 0.25,
                            }}
                          >
                            <Chip
                              label={task.status}
                              size="small"
                              sx={{
                                height: 18,
                                fontSize: "0.65rem",
                              }}
                              variant="outlined"
                            />
                            <Chip
                              label={task.priority}
                              size="small"
                              color={
                                (PRIORITY_COLORS[task.priority] as
                                  | "error"
                                  | "warning"
                                  | "info") || "default"
                              }
                              sx={{
                                height: 18,
                                fontSize: "0.65rem",
                              }}
                              variant="outlined"
                            />
                            {task.dueDate && (
                              <Typography
                                component="span"
                                variant="caption"
                                sx={{ color: "text.secondary" }}
                              >
                                Due: {formatDate(task.dueDate)}
                              </Typography>
                            )}
                          </Box>
                        }
                        slotProps={{
                          primary: {
                            sx: {
                              fontWeight: 500,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                              fontSize: "0.875rem",
                            },
                          },
                        }}
                      />
                    </ListItem>
                  ))}
                </List>
              )}
            </Section>

            {/* Associated Deals */}
            <Section title="Deals">
              {deals.length === 0 ? (
                <Typography variant="body2" sx={{ color: "text.secondary" }}>
                  No associated deals.
                </Typography>
              ) : (
                <List dense disablePadding>
                  {deals.map((deal) => (
                    <ListItem
                      key={deal.id}
                      disablePadding
                      sx={{
                        py: 0.75,
                        borderBottom: 1,
                        borderColor: "divider",
                        "&:last-child": { borderBottom: 0 },
                      }}
                    >
                      <ListItemText
                        primary={deal.title}
                        secondary={
                          <Box
                            component="span"
                            sx={{
                              display: "flex",
                              gap: 1,
                              alignItems: "center",
                              mt: 0.25,
                            }}
                          >
                            <Chip
                              label={deal.status}
                              size="small"
                              color={
                                deal.status === "won"
                                  ? "success"
                                  : deal.status === "lost"
                                    ? "error"
                                    : "default"
                              }
                              sx={{
                                height: 18,
                                fontSize: "0.65rem",
                              }}
                              variant="outlined"
                            />
                            {deal.value != null && (
                              <Typography
                                component="span"
                                variant="caption"
                                sx={{ color: "text.secondary" }}
                              >
                                {formatCurrency(deal.value)}
                              </Typography>
                            )}
                            {deal.stage?.name && (
                              <Typography
                                component="span"
                                variant="caption"
                                sx={{ color: "text.secondary" }}
                              >
                                • {deal.stage.name}
                              </Typography>
                            )}
                          </Box>
                        }
                        slotProps={{
                          primary: {
                            sx: {
                              fontWeight: 500,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                              fontSize: "0.875rem",
                            },
                          },
                        }}
                      />
                    </ListItem>
                  ))}
                </List>
              )}
            </Section>

            {/* Purchase History */}
            <Section title="Purchase History">
              {purchaseHistory.length === 0 ? (
                <Typography variant="body2" sx={{ color: "text.secondary" }}>
                  No purchase history.
                </Typography>
              ) : (
                <Box
                  sx={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 1.5,
                  }}
                >
                  {purchaseHistory.map((purchase) => (
                    <Paper
                      key={purchase.dealId}
                      elevation={0}
                      sx={{
                        p: 1.5,
                        bgcolor: "background.paper",
                        border: 1,
                        borderColor: "divider",
                        borderRadius: 1,
                      }}
                    >
                      <Box
                        sx={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          mb: 1,
                        }}
                      >
                        <Typography
                          variant="body2"
                          sx={{ fontWeight: 600, color: "text.primary" }}
                        >
                          {purchase.dealTitle}
                        </Typography>
                        <Typography
                          variant="caption"
                          sx={{ color: "text.secondary" }}
                        >
                          {formatDate(purchase.closedAt)}
                        </Typography>
                      </Box>
                      {purchase.items.map((item, idx) => (
                        <Box
                          key={idx}
                          sx={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            py: 0.25,
                          }}
                        >
                          <Box
                            sx={{
                              display: "flex",
                              alignItems: "center",
                              gap: 0.5,
                            }}
                          >
                            <ShoppingBag
                              sx={{
                                fontSize: 14,
                                color: "text.secondary",
                              }}
                            />
                            <Typography
                              variant="caption"
                              sx={{ color: "text.primary" }}
                            >
                              {item.name}
                            </Typography>
                          </Box>
                          <Typography
                            variant="caption"
                            sx={{ color: "text.secondary" }}
                          >
                            {item.quantity} × {formatCurrency(item.unitPrice)}
                          </Typography>
                        </Box>
                      ))}
                    </Paper>
                  ))}
                </Box>
              )}
            </Section>

            {/* AI Suggestion Card */}
            <Section title="AI Suggestion">
              {suggestionLoading && (
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 1,
                    py: 1,
                  }}
                >
                  <CircularProgress size={18} />
                  <Typography variant="body2" sx={{ color: "text.secondary" }}>
                    Generating suggestion...
                  </Typography>
                </Box>
              )}
              {!suggestionLoading && suggestionError && (
                <Paper
                  elevation={0}
                  sx={{
                    p: 2,
                    bgcolor: "background.paper",
                    border: 1,
                    borderColor: "divider",
                    borderRadius: 1,
                    display: "flex",
                    alignItems: "center",
                    gap: 1.5,
                  }}
                >
                  <ErrorOutlined
                    sx={{ color: "text.secondary", fontSize: 20 }}
                  />
                  <Box sx={{ flex: 1 }}>
                    <Typography
                      variant="body2"
                      sx={{ color: "text.secondary" }}
                    >
                      AI suggestions are temporarily unavailable.
                    </Typography>
                  </Box>
                  <IconButton
                    size="small"
                    onClick={() => contactId && fetchSuggestion(contactId)}
                    aria-label="Retry AI suggestion"
                    sx={{ color: "text.secondary" }}
                  >
                    <Refresh fontSize="small" />
                  </IconButton>
                </Paper>
              )}
              {!suggestionLoading &&
                !suggestionError &&
                suggestion &&
                suggestion.suggestion && (
                  <Paper
                    elevation={0}
                    sx={{
                      p: 2,
                      bgcolor: "background.paper",
                      border: 1,
                      borderColor: "divider",
                      borderRadius: 1,
                    }}
                  >
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: 1.5,
                      }}
                    >
                      <Lightbulb
                        sx={{
                          color: "primary.main",
                          fontSize: 22,
                          mt: 0.25,
                        }}
                      />
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Chip
                          label={suggestion.suggestion
                            .replace(/_/g, " ")
                            .replace(/\b\w/g, (c) => c.toUpperCase())}
                          size="small"
                          color="primary"
                          variant="outlined"
                          sx={{ mb: 0.5 }}
                        />
                        {suggestion.reasoning && (
                          <Typography
                            variant="body2"
                            sx={{ color: "text.secondary", mt: 0.5 }}
                          >
                            {suggestion.reasoning}
                          </Typography>
                        )}
                      </Box>
                    </Box>
                  </Paper>
                )}
              {!suggestionLoading &&
                !suggestionError &&
                suggestion &&
                suggestion.reason === "insufficient_activities" && (
                  <Typography variant="body2" sx={{ color: "text.secondary" }}>
                    Not enough activity data for suggestions (need at least 2
                    activities).
                  </Typography>
                )}
              {!suggestionLoading && !suggestionError && !suggestion && (
                <Typography variant="body2" sx={{ color: "text.secondary" }}>
                  No suggestions available for this contact.
                </Typography>
              )}
            </Section>

            {/* Marketing Campaigns */}
            <Section title="Marketing Campaigns">
              {campaigns.length === 0 ? (
                <Typography variant="body2" sx={{ color: "text.secondary" }}>
                  Not part of any campaigns.
                </Typography>
              ) : (
                <List dense disablePadding>
                  {campaigns.map((campaign) => (
                    <ListItem
                      key={campaign.id}
                      disablePadding
                      sx={{
                        py: 0.75,
                        borderBottom: 1,
                        borderColor: "divider",
                        "&:last-child": { borderBottom: 0 },
                      }}
                    >
                      <ListItemIcon sx={{ minWidth: 32 }}>
                        <Campaign
                          fontSize="small"
                          sx={{ color: "text.secondary" }}
                        />
                      </ListItemIcon>
                      <ListItemText
                        primary={campaign.name}
                        secondary={
                          <Box
                            component="span"
                            sx={{
                              display: "flex",
                              gap: 1,
                              alignItems: "center",
                              mt: 0.25,
                            }}
                          >
                            <Chip
                              label={campaign.status}
                              size="small"
                              sx={{
                                height: 18,
                                fontSize: "0.65rem",
                              }}
                              variant="outlined"
                            />
                            {campaign.scheduledAt && (
                              <Typography
                                component="span"
                                variant="caption"
                                sx={{ color: "text.secondary" }}
                              >
                                Scheduled: {formatDate(campaign.scheduledAt)}
                              </Typography>
                            )}
                          </Box>
                        }
                        slotProps={{
                          primary: {
                            sx: {
                              fontWeight: 500,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                              fontSize: "0.875rem",
                            },
                          },
                        }}
                      />
                    </ListItem>
                  ))}
                </List>
              )}
            </Section>

            {/* Action Buttons */}
            <Divider sx={{ my: 1 }} />
            <Box sx={{ display: "flex", gap: 1.5, pb: 2 }}>
              <Button
                variant="contained"
                startIcon={<CalendarToday />}
                onClick={() => contactId && onCreateAppointment?.(contactId)}
                sx={{ flex: 1 }}
                size="small"
              >
                Create Appointment
              </Button>
              <Button
                variant="outlined"
                startIcon={<Add />}
                onClick={() => contactId && onCreateTask?.(contactId)}
                sx={{ flex: 1 }}
                size="small"
              >
                Create Task
              </Button>
            </Box>
          </Box>
        </Box>
      )}
    </Drawer>
  );
};

// --- Sub-components ---

interface SectionProps {
  title: string;
  children: React.ReactNode;
}

const Section: React.FC<SectionProps> = ({ title, children }) => (
  <Box>
    <Typography
      variant="subtitle2"
      sx={{
        mb: 1,
        color: "text.primary",
        fontWeight: 600,
        fontSize: "0.85rem",
      }}
    >
      {title}
    </Typography>
    {children}
  </Box>
);

interface InfoRowProps {
  icon: React.ReactNode;
  label: string;
  value: string;
}

const InfoRow: React.FC<InfoRowProps> = ({ icon, label, value }) => (
  <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
    <Box sx={{ color: "text.secondary", display: "flex" }}>{icon}</Box>
    <Box sx={{ flex: 1, minWidth: 0 }}>
      <Typography
        variant="caption"
        sx={{ color: "text.secondary", display: "block" }}
      >
        {label}
      </Typography>
      <Typography variant="body2" sx={{ color: "text.primary" }} noWrap>
        {value}
      </Typography>
    </Box>
  </Box>
);

interface MetricCardProps {
  label: string;
  value: string;
  icon: React.ReactNode;
}

const MetricCard: React.FC<MetricCardProps> = ({ label, value, icon }) => (
  <Paper
    elevation={0}
    sx={{
      p: 1.5,
      bgcolor: "background.paper",
      border: 1,
      borderColor: "divider",
      borderRadius: 1,
      display: "flex",
      alignItems: "center",
      gap: 1,
    }}
  >
    <Box sx={{ color: "primary.main", display: "flex" }}>{icon}</Box>
    <Box>
      <Typography
        variant="caption"
        sx={{ color: "text.secondary", display: "block" }}
      >
        {label}
      </Typography>
      <Typography
        variant="body2"
        sx={{ color: "text.primary", fontWeight: 600 }}
      >
        {value}
      </Typography>
    </Box>
  </Paper>
);

export default ContactProfileDrawer;
