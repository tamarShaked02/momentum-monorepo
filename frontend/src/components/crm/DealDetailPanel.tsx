import React, { useCallback, useEffect, useState } from "react";
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import {
  Close,
  Add,
  Edit,
  Delete,
  Assignment,
  CalendarToday,
  Person,
  Lightbulb,
  ErrorOutlined,
  Refresh,
  Inventory2,
} from "@mui/icons-material";
import {
  getDeal,
  getDealSuggestion,
  addDealItem,
  updateDealItem,
  removeDealItem,
} from "../../api/crm";
import type { Deal, DealItem, DealStatus, AISuggestion } from "../../types/crm";
import ActivityTimeline from "./ActivityTimeline";

// --- Types ---

interface LinkedTask {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueDate: string | null;
  category: string | null;
}

interface DealWithDetails extends Deal {
  linkedTasks?: LinkedTask[];
}

export interface DealDetailPanelProps {
  open: boolean;
  dealId: string | null;
  onClose: () => void;
  onContactClick?: (contactId: string) => void;
  onCreateTask?: (dealId: string) => void;
}

// --- Constants ---

const DRAWER_WIDTH = 520;

const STATUS_COLORS: Record<DealStatus, string> = {
  open: "#4FC3F7",
  won: "#66BB6A",
  lost: "#FF6B6B",
};

const STATUS_LABELS: Record<DealStatus, string> = {
  open: "Open",
  won: "Won",
  lost: "Lost",
};

const PRIORITY_COLORS: Record<
  string,
  "error" | "warning" | "info" | "default"
> = {
  high: "error",
  medium: "warning",
  low: "info",
};

// --- Helpers ---

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

function calculateDealTotal(items: DealItem[]): number {
  return items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
}

// --- Component ---

/**
 * DealDetailPanel – a slide-out panel showing deal details.
 * Displays deal info, linked inventory items, activity timeline,
 * linked tasks, and AI suggestion card.
 *
 * Validates: Requirements 2.6, 4.4, 10.1, 10.2, 10.3, 12.1, 13.2
 */
const DealDetailPanel: React.FC<DealDetailPanelProps> = ({
  open,
  dealId,
  onClose,
  onContactClick,
  onCreateTask,
}) => {
  const [deal, setDeal] = useState<DealWithDetails | null>(null);
  const [loading, setLoading] = useState(false);
  const [suggestion, setSuggestion] = useState<AISuggestion | null>(null);
  const [suggestionLoading, setSuggestionLoading] = useState(false);
  const [suggestionError, setSuggestionError] = useState(false);

  // Item dialog state
  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<DealItem | null>(null);
  const [itemForm, setItemForm] = useState({
    inventoryItemId: "",
    quantity: "1",
    unitPrice: "",
  });
  const [itemSaving, setItemSaving] = useState(false);

  // Fetch deal data
  const fetchDeal = useCallback(async (id: string) => {
    setLoading(true);
    try {
      const data = await getDeal(id);
      setDeal(data as DealWithDetails);
    } catch (error) {
      console.error("Failed to fetch deal:", error);
    } finally {
      setLoading(false);
    }
    // Fetch AI suggestion separately
    fetchSuggestion(id);
  }, []);

  const fetchSuggestion = async (id: string) => {
    setSuggestionLoading(true);
    setSuggestionError(false);
    try {
      const data = await getDealSuggestion(id);
      setSuggestion(data);
    } catch {
      setSuggestionError(true);
      setSuggestion(null);
    } finally {
      setSuggestionLoading(false);
    }
  };

  useEffect(() => {
    if (open && dealId) {
      fetchDeal(dealId);
    }
    if (!open) {
      setDeal(null);
      setSuggestion(null);
      setSuggestionError(false);
    }
  }, [open, dealId, fetchDeal]);

  // --- Item CRUD handlers ---

  const handleOpenAddItem = () => {
    setEditingItem(null);
    setItemForm({ inventoryItemId: "", quantity: "1", unitPrice: "" });
    setItemDialogOpen(true);
  };

  const handleOpenEditItem = (item: DealItem) => {
    setEditingItem(item);
    setItemForm({
      inventoryItemId: item.inventoryItemId,
      quantity: String(item.quantity),
      unitPrice: String(item.unitPrice),
    });
    setItemDialogOpen(true);
  };

  const handleCloseItemDialog = () => {
    setItemDialogOpen(false);
    setEditingItem(null);
  };

  const handleSaveItem = async () => {
    if (!dealId) return;
    const quantity = parseInt(itemForm.quantity, 10);
    const unitPrice = parseFloat(itemForm.unitPrice);

    if (!quantity || quantity < 1 || quantity > 10000) return;
    if (!unitPrice || unitPrice < 0.01 || unitPrice > 999999.99) return;

    setItemSaving(true);
    try {
      if (editingItem) {
        await updateDealItem(dealId, editingItem.id, { quantity, unitPrice });
      } else {
        if (!itemForm.inventoryItemId) return;
        await addDealItem(dealId, {
          inventoryItemId: itemForm.inventoryItemId,
          quantity,
          unitPrice,
        });
      }
      // Refresh deal data
      await fetchDeal(dealId);
      handleCloseItemDialog();
    } catch (error) {
      console.error("Failed to save deal item:", error);
    } finally {
      setItemSaving(false);
    }
  };

  const handleRemoveItem = async (itemId: string) => {
    if (!dealId) return;
    try {
      await removeDealItem(dealId, itemId);
      await fetchDeal(dealId);
    } catch (error) {
      console.error("Failed to remove deal item:", error);
    }
  };

  // --- Linked tasks (sorted by due date ascending, nulls last) ---
  const linkedTasks: LinkedTask[] = (deal?.linkedTasks || []).sort((a, b) => {
    if (!a.dueDate && !b.dueDate) return 0;
    if (!a.dueDate) return 1;
    if (!b.dueDate) return -1;
    return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
  });

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
      {!loading && deal && (
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
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography
                variant="h6"
                sx={{ fontWeight: 600, color: "text.primary" }}
                noWrap
              >
                {deal.title}
              </Typography>
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 1,
                  mt: 0.5,
                }}
              >
                <Chip
                  label={STATUS_LABELS[deal.status]}
                  size="small"
                  sx={{
                    bgcolor: `${STATUS_COLORS[deal.status]}22`,
                    color: STATUS_COLORS[deal.status],
                    border: `1px solid ${STATUS_COLORS[deal.status]}44`,
                    fontWeight: 500,
                  }}
                />
                {deal.value != null && (
                  <Typography
                    variant="body2"
                    sx={{ color: "text.primary", fontWeight: 600 }}
                  >
                    {formatCurrency(deal.value)}
                  </Typography>
                )}
              </Box>
            </Box>
            <IconButton
              onClick={onClose}
              size="small"
              aria-label="Close panel"
              sx={{ color: "text.secondary" }}
            >
              <Close />
            </IconButton>
          </Box>

          {/* Body */}
          <Box sx={{ p: 3, display: "flex", flexDirection: "column", gap: 3 }}>
            {/* Deal Info Section */}
            <Section title="Deal Info">
              <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
                <InfoRow label="Stage" value={deal.stage?.name || "—"} />
                <InfoRow label="Pipeline" value={deal.pipeline?.name || "—"} />
                <InfoRow
                  label="Contact"
                  value={deal.contact?.name || "—"}
                  onClick={
                    deal.contactId && onContactClick
                      ? () => onContactClick(deal.contactId)
                      : undefined
                  }
                  icon={<Person fontSize="small" />}
                />
                <InfoRow
                  label="Expected Close"
                  value={formatDate(deal.expectedCloseDate)}
                  icon={<CalendarToday fontSize="small" />}
                />
                <InfoRow
                  label="Win Probability"
                  value={
                    deal.winProbability != null
                      ? `${deal.winProbability}%`
                      : "—"
                  }
                />
              </Box>
            </Section>

            {/* Linked Inventory Items */}
            <Section title="Linked Items">
              {deal.items && deal.items.length > 0 ? (
                <>
                  <TableContainer>
                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell
                            sx={{ color: "text.secondary", fontWeight: 600 }}
                          >
                            Item
                          </TableCell>
                          <TableCell
                            align="right"
                            sx={{ color: "text.secondary", fontWeight: 600 }}
                          >
                            Qty
                          </TableCell>
                          <TableCell
                            align="right"
                            sx={{ color: "text.secondary", fontWeight: 600 }}
                          >
                            Unit Price
                          </TableCell>
                          <TableCell
                            align="right"
                            sx={{ color: "text.secondary", fontWeight: 600 }}
                          >
                            Total
                          </TableCell>
                          <TableCell align="right" sx={{ width: 72 }} />
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {deal.items.map((item) => (
                          <TableRow key={item.id}>
                            <TableCell sx={{ color: "text.primary" }}>
                              {item.inventoryItem?.name || "Unknown Item"}
                            </TableCell>
                            <TableCell
                              align="right"
                              sx={{ color: "text.primary" }}
                            >
                              {item.quantity}
                            </TableCell>
                            <TableCell
                              align="right"
                              sx={{ color: "text.primary" }}
                            >
                              {formatCurrency(item.unitPrice)}
                            </TableCell>
                            <TableCell
                              align="right"
                              sx={{ color: "text.primary", fontWeight: 500 }}
                            >
                              {formatCurrency(item.quantity * item.unitPrice)}
                            </TableCell>
                            <TableCell align="right">
                              <IconButton
                                size="small"
                                onClick={() => handleOpenEditItem(item)}
                                aria-label={`Edit item ${item.inventoryItem?.name || "item"}`}
                                sx={{ color: "text.secondary" }}
                              >
                                <Edit fontSize="small" />
                              </IconButton>
                              <IconButton
                                size="small"
                                onClick={() => handleRemoveItem(item.id)}
                                aria-label={`Remove item ${item.inventoryItem?.name || "item"}`}
                                sx={{
                                  color: "text.secondary",
                                  "&:hover": { color: "error.main" },
                                }}
                              >
                                <Delete fontSize="small" />
                              </IconButton>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                  <Box
                    sx={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      mt: 1,
                      px: 1,
                    }}
                  >
                    <Typography
                      variant="body2"
                      sx={{ color: "text.secondary", fontWeight: 600 }}
                    >
                      Total: {formatCurrency(calculateDealTotal(deal.items))}
                    </Typography>
                    <Button
                      size="small"
                      startIcon={<Add />}
                      onClick={handleOpenAddItem}
                      sx={{ color: "primary.main" }}
                    >
                      Add Item
                    </Button>
                  </Box>
                </>
              ) : (
                <Box
                  sx={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <Typography variant="body2" sx={{ color: "text.secondary" }}>
                    No linked items.
                  </Typography>
                  <Button
                    size="small"
                    startIcon={<Add />}
                    onClick={handleOpenAddItem}
                    sx={{ color: "primary.main" }}
                  >
                    Add Item
                  </Button>
                </Box>
              )}
            </Section>

            {/* Activity Timeline */}
            <Section title="Activity">
              <ActivityTimeline dealId={deal.id} />
            </Section>

            {/* Linked Tasks */}
            <Section title="Linked Tasks">
              {linkedTasks.length === 0 ? (
                <Typography variant="body2" sx={{ color: "text.secondary" }}>
                  No linked tasks.
                </Typography>
              ) : (
                <List dense disablePadding>
                  {linkedTasks.map((task) => (
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
                              sx={{ height: 18, fontSize: "0.65rem" }}
                              variant="outlined"
                            />
                            <Chip
                              label={task.priority}
                              size="small"
                              color={
                                PRIORITY_COLORS[task.priority] || "default"
                              }
                              sx={{ height: 18, fontSize: "0.65rem" }}
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
                    onClick={() => dealId && fetchSuggestion(dealId)}
                    aria-label="Retry AI suggestion"
                    sx={{ color: "text.secondary" }}
                  >
                    <Refresh fontSize="small" />
                  </IconButton>
                </Paper>
              )}
              {!suggestionLoading && !suggestionError && suggestion && (
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
                      {suggestion.suggestion && (
                        <Chip
                          label={suggestion.suggestion
                            .replace(/_/g, " ")
                            .replace(/\b\w/g, (c) => c.toUpperCase())}
                          size="small"
                          color="primary"
                          variant="outlined"
                          sx={{ mb: 0.5 }}
                        />
                      )}
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
              {!suggestionLoading && !suggestionError && !suggestion && (
                <Typography variant="body2" sx={{ color: "text.secondary" }}>
                  No suggestions available for this deal.
                </Typography>
              )}
            </Section>

            {/* Action Button: Create Task */}
            <Divider sx={{ my: 1 }} />
            <Box sx={{ display: "flex", gap: 1.5, pb: 2 }}>
              <Button
                variant="contained"
                startIcon={<Add />}
                onClick={() => dealId && onCreateTask?.(dealId)}
                size="small"
                sx={{ flex: 1 }}
              >
                Create Task
              </Button>
            </Box>
          </Box>
        </Box>
      )}

      {/* Item Add/Edit Dialog */}
      <Dialog
        open={itemDialogOpen}
        onClose={handleCloseItemDialog}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>
          {editingItem ? "Edit Item" : "Add Item to Deal"}
        </DialogTitle>
        <DialogContent
          sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 2 }}
        >
          {!editingItem && (
            <TextField
              label="Inventory Item ID"
              value={itemForm.inventoryItemId}
              onChange={(e) =>
                setItemForm((prev) => ({
                  ...prev,
                  inventoryItemId: e.target.value,
                }))
              }
              size="small"
              fullWidth
              placeholder="Enter inventory item ID"
              slotProps={{
                input: {
                  startAdornment: (
                    <Inventory2
                      fontSize="small"
                      sx={{ color: "text.secondary", mr: 1 }}
                    />
                  ),
                },
              }}
            />
          )}
          <TextField
            label="Quantity"
            type="number"
            value={itemForm.quantity}
            onChange={(e) =>
              setItemForm((prev) => ({ ...prev, quantity: e.target.value }))
            }
            size="small"
            fullWidth
            slotProps={{
              htmlInput: { min: 1, max: 10000 },
            }}
          />
          <TextField
            label="Unit Price"
            type="number"
            value={itemForm.unitPrice}
            onChange={(e) =>
              setItemForm((prev) => ({ ...prev, unitPrice: e.target.value }))
            }
            size="small"
            fullWidth
            slotProps={{
              htmlInput: { min: 0.01, max: 999999.99, step: 0.01 },
            }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseItemDialog} size="small">
            Cancel
          </Button>
          <Button
            onClick={handleSaveItem}
            variant="contained"
            size="small"
            disabled={itemSaving}
          >
            {itemSaving ? (
              <CircularProgress size={16} />
            ) : editingItem ? (
              "Update"
            ) : (
              "Add"
            )}
          </Button>
        </DialogActions>
      </Dialog>
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
  label: string;
  value: string;
  icon?: React.ReactNode;
  onClick?: () => void;
}

const InfoRow: React.FC<InfoRowProps> = ({ label, value, icon, onClick }) => (
  <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
    {icon && (
      <Box sx={{ color: "text.secondary", display: "flex" }}>{icon}</Box>
    )}
    <Box sx={{ flex: 1, minWidth: 0 }}>
      <Typography
        variant="caption"
        sx={{ color: "text.secondary", display: "block" }}
      >
        {label}
      </Typography>
      <Typography
        variant="body2"
        sx={{
          color: onClick ? "primary.main" : "text.primary",
          cursor: onClick ? "pointer" : "default",
          textDecoration: onClick ? "underline" : "none",
          "&:hover": onClick ? { color: "primary.light" } : {},
        }}
        noWrap
        onClick={onClick}
        role={onClick ? "link" : undefined}
        tabIndex={onClick ? 0 : undefined}
        onKeyDown={
          onClick
            ? (e) => {
                if (e.key === "Enter" || e.key === " ") onClick();
              }
            : undefined
        }
      >
        {value}
      </Typography>
    </Box>
  </Box>
);

export default DealDetailPanel;
