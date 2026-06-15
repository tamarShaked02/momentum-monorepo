import React, { useState, useEffect, useCallback } from "react";
import {
  Box,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  IconButton,
  Typography,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Switch,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Collapse,
  Divider,
  Chip,
  Alert,
  Snackbar,
  CircularProgress,
  useTheme,
} from "@mui/material";
import {
  Close,
  Add,
  Delete,
  Edit,
  ExpandMore,
  ExpandLess,
  CheckCircle,
  Error as ErrorIcon,
} from "@mui/icons-material";
import type {
  AutomationRule,
  AutomationRuleLog,
  AutomationTrigger,
  AutomationAction,
  AutomationTriggerType,
  AutomationActionType,
  AutomationRuleCreateData,
} from "../../types/crm";
import {
  AUTOMATION_TRIGGER_TYPES,
  AUTOMATION_ACTION_TYPES,
} from "../../types/crm";
import {
  getAutomationRules,
  createAutomationRule,
  updateAutomationRule,
  toggleAutomationRule,
  deleteAutomationRule,
  getAutomationRuleLogs,
} from "../../api/crm";

export interface AutomationRulesDialogProps {
  open: boolean;
  onClose: () => void;
}

type ViewMode = "list" | "create" | "edit";

const TRIGGER_LABELS: Record<AutomationTriggerType, string> = {
  deal_stage_changed: "Deal Stage Changed",
  deal_created: "Deal Created",
  deal_stale: "Deal Stale",
  contact_lifecycle_changed: "Contact Lifecycle Changed",
  appointment_completed: "Appointment Completed",
};

const ACTION_LABELS: Record<AutomationActionType, string> = {
  create_task: "Create Task",
  move_deal_to_stage: "Move Deal to Stage",
  change_contact_lifecycle: "Change Contact Lifecycle",
  send_telegram_message: "Send Telegram Message",
  log_activity: "Log Activity",
};

const AutomationRulesDialog: React.FC<AutomationRulesDialogProps> = ({
  open,
  onClose,
}) => {
  const theme = useTheme();

  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);

  // Rule builder state
  const [ruleName, setRuleName] = useState("");
  const [triggerType, setTriggerType] =
    useState<AutomationTriggerType>("deal_stage_changed");
  const [triggerParams, setTriggerParams] = useState<Record<string, unknown>>(
    {},
  );
  const [actions, setActions] = useState<AutomationAction[]>([
    { type: "create_task", params: {} },
  ]);

  // Logs state
  const [expandedLogs, setExpandedLogs] = useState<string | null>(null);
  const [logs, setLogs] = useState<Record<string, AutomationRuleLog[]>>({});
  const [logsLoading, setLogsLoading] = useState<string | null>(null);

  // Snackbar
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: "success" | "error";
  }>({ open: false, message: "", severity: "success" });

  const fetchRules = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getAutomationRules();
      setRules(data);
    } catch {
      setSnackbar({
        open: true,
        message: "Failed to load automation rules.",
        severity: "error",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      fetchRules();
      setViewMode("list");
    }
  }, [open, fetchRules]);

  const resetBuilder = () => {
    setRuleName("");
    setTriggerType("deal_stage_changed");
    setTriggerParams({});
    setActions([{ type: "create_task", params: {} }]);
    setEditingRuleId(null);
  };

  const handleCreate = () => {
    resetBuilder();
    setViewMode("create");
  };

  const handleEdit = (rule: AutomationRule) => {
    setRuleName(rule.name);
    setTriggerType(rule.trigger.type);
    setTriggerParams(rule.trigger.params ?? {});
    setActions(
      rule.actions.length > 0
        ? rule.actions
        : [{ type: "create_task", params: {} }],
    );
    setEditingRuleId(rule.id);
    setViewMode("edit");
  };

  const handleSave = async () => {
    if (!ruleName.trim()) {
      setSnackbar({
        open: true,
        message: "Rule name is required.",
        severity: "error",
      });
      return;
    }
    if (actions.length < 1 || actions.length > 10) {
      setSnackbar({
        open: true,
        message: "A rule must have between 1 and 10 actions.",
        severity: "error",
      });
      return;
    }

    const trigger: AutomationTrigger = {
      type: triggerType,
      params: Object.keys(triggerParams).length > 0 ? triggerParams : undefined,
    };

    const ruleData: AutomationRuleCreateData = {
      name: ruleName.trim(),
      trigger,
      actions,
    };

    try {
      if (viewMode === "edit" && editingRuleId) {
        await updateAutomationRule(editingRuleId, ruleData);
        setSnackbar({
          open: true,
          message: "Rule updated successfully.",
          severity: "success",
        });
      } else {
        await createAutomationRule(ruleData);
        setSnackbar({
          open: true,
          message: "Rule created successfully.",
          severity: "success",
        });
      }
      setViewMode("list");
      resetBuilder();
      fetchRules();
    } catch {
      setSnackbar({
        open: true,
        message: "Failed to save rule. Please try again.",
        severity: "error",
      });
    }
  };

  const handleToggle = async (rule: AutomationRule) => {
    try {
      await toggleAutomationRule(rule.id, !rule.enabled);
      setRules((prev) =>
        prev.map((r) => (r.id === rule.id ? { ...r, enabled: !r.enabled } : r)),
      );
    } catch {
      setSnackbar({
        open: true,
        message: "Failed to toggle rule.",
        severity: "error",
      });
    }
  };

  const handleDelete = async (ruleId: string) => {
    try {
      await deleteAutomationRule(ruleId);
      setRules((prev) => prev.filter((r) => r.id !== ruleId));
      setSnackbar({
        open: true,
        message: "Rule deleted.",
        severity: "success",
      });
    } catch {
      setSnackbar({
        open: true,
        message: "Failed to delete rule.",
        severity: "error",
      });
    }
  };

  const handleToggleLogs = async (ruleId: string) => {
    if (expandedLogs === ruleId) {
      setExpandedLogs(null);
      return;
    }
    setExpandedLogs(ruleId);
    if (!logs[ruleId]) {
      setLogsLoading(ruleId);
      try {
        const result = await getAutomationRuleLogs(ruleId, { pageSize: 10 });
        setLogs((prev) => ({ ...prev, [ruleId]: result.logs }));
      } catch {
        setSnackbar({
          open: true,
          message: "Failed to load execution logs.",
          severity: "error",
        });
      } finally {
        setLogsLoading(null);
      }
    }
  };

  const handleAddAction = () => {
    if (actions.length >= 10) return;
    setActions([...actions, { type: "create_task", params: {} }]);
  };

  const handleRemoveAction = (index: number) => {
    if (actions.length <= 1) return;
    setActions(actions.filter((_, i) => i !== index));
  };

  const handleActionTypeChange = (
    index: number,
    type: AutomationActionType,
  ) => {
    setActions(actions.map((a, i) => (i === index ? { type, params: {} } : a)));
  };

  const handleActionParamChange = (
    index: number,
    key: string,
    value: string,
  ) => {
    setActions(
      actions.map((a, i) =>
        i === index ? { ...a, params: { ...a.params, [key]: value } } : a,
      ),
    );
  };

  const renderTriggerParams = () => {
    switch (triggerType) {
      case "deal_stage_changed":
        return (
          <Box sx={{ display: "flex", gap: 1, mt: 1 }}>
            <TextField
              size="small"
              label="Source Stage (optional)"
              value={(triggerParams.sourceStage as string) ?? ""}
              onChange={(e) =>
                setTriggerParams({
                  ...triggerParams,
                  sourceStage: e.target.value,
                })
              }
              sx={{ flex: 1 }}
            />
            <TextField
              size="small"
              label="Target Stage (optional)"
              value={(triggerParams.targetStage as string) ?? ""}
              onChange={(e) =>
                setTriggerParams({
                  ...triggerParams,
                  targetStage: e.target.value,
                })
              }
              sx={{ flex: 1 }}
            />
          </Box>
        );
      case "deal_stale":
        return (
          <TextField
            size="small"
            label="Inactive Days"
            type="number"
            value={(triggerParams.inactiveDays as string) ?? "14"}
            onChange={(e) =>
              setTriggerParams({
                ...triggerParams,
                inactiveDays: e.target.value,
              })
            }
            slotProps={{
              input: { inputProps: { min: 1, max: 365 } },
            }}
            sx={{ mt: 1 }}
          />
        );
      case "contact_lifecycle_changed":
        return (
          <Box sx={{ display: "flex", gap: 1, mt: 1 }}>
            <TextField
              size="small"
              label="Source Stage (optional)"
              value={(triggerParams.sourceLifecycle as string) ?? ""}
              onChange={(e) =>
                setTriggerParams({
                  ...triggerParams,
                  sourceLifecycle: e.target.value,
                })
              }
              sx={{ flex: 1 }}
            />
            <TextField
              size="small"
              label="Target Stage (optional)"
              value={(triggerParams.targetLifecycle as string) ?? ""}
              onChange={(e) =>
                setTriggerParams({
                  ...triggerParams,
                  targetLifecycle: e.target.value,
                })
              }
              sx={{ flex: 1 }}
            />
          </Box>
        );
      default:
        return null;
    }
  };

  const renderActionParams = (action: AutomationAction, index: number) => {
    switch (action.type) {
      case "create_task":
        return (
          <Box sx={{ display: "flex", gap: 1, mt: 0.5 }}>
            <TextField
              size="small"
              label="Task Title"
              value={(action.params.title as string) ?? ""}
              onChange={(e) =>
                handleActionParamChange(index, "title", e.target.value)
              }
              sx={{ flex: 2 }}
            />
            <TextField
              size="small"
              label="Due (days)"
              type="number"
              value={(action.params.dueDateOffset as string) ?? ""}
              onChange={(e) =>
                handleActionParamChange(index, "dueDateOffset", e.target.value)
              }
              slotProps={{
                input: { inputProps: { min: 0 } },
              }}
              sx={{ flex: 1 }}
            />
          </Box>
        );
      case "move_deal_to_stage":
        return (
          <TextField
            size="small"
            label="Target Stage ID"
            value={(action.params.targetStageId as string) ?? ""}
            onChange={(e) =>
              handleActionParamChange(index, "targetStageId", e.target.value)
            }
            sx={{ mt: 0.5 }}
            fullWidth
          />
        );
      case "change_contact_lifecycle":
        return (
          <FormControl size="small" sx={{ mt: 0.5, minWidth: 180 }}>
            <InputLabel>Target Lifecycle</InputLabel>
            <Select
              label="Target Lifecycle"
              value={(action.params.targetLifecycle as string) ?? ""}
              onChange={(e) =>
                handleActionParamChange(
                  index,
                  "targetLifecycle",
                  e.target.value as string,
                )
              }
            >
              {["lead", "prospect", "customer", "vip", "churned"].map((lc) => (
                <MenuItem key={lc} value={lc}>
                  {lc.charAt(0).toUpperCase() + lc.slice(1)}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        );
      case "send_telegram_message":
        return (
          <TextField
            size="small"
            label="Message Template"
            value={(action.params.messageTemplate as string) ?? ""}
            onChange={(e) =>
              handleActionParamChange(index, "messageTemplate", e.target.value)
            }
            multiline
            minRows={2}
            maxRows={4}
            sx={{ mt: 0.5 }}
            fullWidth
          />
        );
      case "log_activity":
        return (
          <Box sx={{ display: "flex", gap: 1, mt: 0.5 }}>
            <TextField
              size="small"
              label="Activity Type"
              value={(action.params.activityType as string) ?? ""}
              onChange={(e) =>
                handleActionParamChange(index, "activityType", e.target.value)
              }
              sx={{ flex: 1 }}
            />
            <TextField
              size="small"
              label="Description"
              value={(action.params.description as string) ?? ""}
              onChange={(e) =>
                handleActionParamChange(index, "description", e.target.value)
              }
              sx={{ flex: 2 }}
            />
          </Box>
        );
      default:
        return null;
    }
  };

  const renderRuleList = () => (
    <Box>
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          mb: 2,
        }}
      >
        <Typography
          variant="subtitle1"
          sx={{ color: theme.palette.text.primary }}
        >
          Automation Rules ({rules.length})
        </Typography>
        <Button
          variant="contained"
          size="small"
          startIcon={<Add />}
          onClick={handleCreate}
          data-testid="create-rule-button"
          sx={{ borderRadius: "8px" }}
        >
          New Rule
        </Button>
      </Box>

      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
          <CircularProgress size={28} />
        </Box>
      ) : rules.length === 0 ? (
        <Typography
          variant="body2"
          sx={{
            color: theme.palette.text.secondary,
            textAlign: "center",
            py: 4,
          }}
        >
          No automation rules yet. Create one to get started.
        </Typography>
      ) : (
        <List disablePadding>
          {rules.map((rule) => (
            <React.Fragment key={rule.id}>
              <ListItem
                sx={{
                  borderRadius: "8px",
                  mb: 0.5,
                  backgroundColor: theme.palette.background.default,
                  flexDirection: "column",
                  alignItems: "stretch",
                }}
              >
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    width: "100%",
                  }}
                >
                  <ListItemText
                    primary={rule.name}
                    secondary={TRIGGER_LABELS[rule.trigger.type]}
                    slotProps={{
                      primary: {
                        sx: {
                          color: theme.palette.text.primary,
                          fontWeight: 500,
                        },
                      },
                      secondary: {
                        sx: {
                          color: theme.palette.text.secondary,
                          fontSize: "0.75rem",
                        },
                      },
                    }}
                  />
                  <ListItemSecondaryAction
                    sx={{ display: "flex", alignItems: "center", gap: 0.5 }}
                  >
                    <Switch
                      size="small"
                      checked={rule.enabled}
                      onChange={() => handleToggle(rule)}
                      data-testid={`toggle-rule-${rule.id}`}
                    />
                    <IconButton
                      size="small"
                      onClick={() => handleToggleLogs(rule.id)}
                      data-testid={`logs-rule-${rule.id}`}
                      sx={{ color: theme.palette.text.secondary }}
                    >
                      {expandedLogs === rule.id ? (
                        <ExpandLess fontSize="small" />
                      ) : (
                        <ExpandMore fontSize="small" />
                      )}
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => handleEdit(rule)}
                      data-testid={`edit-rule-${rule.id}`}
                      sx={{ color: theme.palette.text.secondary }}
                    >
                      <Edit fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => handleDelete(rule.id)}
                      data-testid={`delete-rule-${rule.id}`}
                      sx={{ color: theme.palette.error.main }}
                    >
                      <Delete fontSize="small" />
                    </IconButton>
                  </ListItemSecondaryAction>
                </Box>

                <Collapse
                  in={expandedLogs === rule.id}
                  timeout="auto"
                  unmountOnExit
                >
                  <Box sx={{ mt: 1, pl: 1 }}>
                    <Typography
                      variant="caption"
                      sx={{
                        color: theme.palette.text.secondary,
                        fontWeight: 600,
                        mb: 0.5,
                        display: "block",
                      }}
                    >
                      Execution Logs
                    </Typography>
                    {logsLoading === rule.id ? (
                      <CircularProgress size={16} sx={{ ml: 1 }} />
                    ) : (logs[rule.id] ?? []).length === 0 ? (
                      <Typography
                        variant="caption"
                        sx={{ color: theme.palette.text.secondary }}
                      >
                        No execution logs yet.
                      </Typography>
                    ) : (
                      (logs[rule.id] ?? []).map((log) => (
                        <Box
                          key={log.id}
                          sx={{
                            display: "flex",
                            alignItems: "center",
                            gap: 1,
                            py: 0.5,
                          }}
                        >
                          {log.success ? (
                            <CheckCircle
                              sx={{
                                fontSize: 14,
                                color: theme.palette.success.main,
                              }}
                            />
                          ) : (
                            <ErrorIcon
                              sx={{
                                fontSize: 14,
                                color: theme.palette.error.main,
                              }}
                            />
                          )}
                          <Chip
                            label={log.actionType}
                            size="small"
                            sx={{
                              fontSize: "0.65rem",
                              height: 20,
                              backgroundColor: theme.palette.action.hover,
                              color: theme.palette.text.secondary,
                            }}
                          />
                          <Typography
                            variant="caption"
                            sx={{ color: theme.palette.text.secondary }}
                          >
                            {new Date(log.createdAt).toLocaleString()}
                          </Typography>
                          {log.error && (
                            <Typography
                              variant="caption"
                              sx={{ color: theme.palette.error.main }}
                            >
                              {log.error}
                            </Typography>
                          )}
                        </Box>
                      ))
                    )}
                  </Box>
                </Collapse>
              </ListItem>
              <Divider sx={{ opacity: 0.3 }} />
            </React.Fragment>
          ))}
        </List>
      )}
    </Box>
  );

  const renderRuleBuilder = () => (
    <Box>
      <Typography
        variant="subtitle1"
        sx={{ color: theme.palette.text.primary, mb: 2 }}
      >
        {viewMode === "edit" ? "Edit Rule" : "Create Rule"}
      </Typography>

      <TextField
        fullWidth
        size="small"
        label="Rule Name"
        value={ruleName}
        onChange={(e) => setRuleName(e.target.value)}
        data-testid="rule-name-input"
        sx={{ mb: 2 }}
        slotProps={{
          htmlInput: { maxLength: 200 },
        }}
      />

      <FormControl fullWidth size="small" sx={{ mb: 1 }}>
        <InputLabel>Trigger Type</InputLabel>
        <Select
          label="Trigger Type"
          value={triggerType}
          onChange={(e) => {
            setTriggerType(e.target.value as AutomationTriggerType);
            setTriggerParams({});
          }}
          data-testid="trigger-type-select"
        >
          {AUTOMATION_TRIGGER_TYPES.map((t) => (
            <MenuItem key={t} value={t}>
              {TRIGGER_LABELS[t]}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      {renderTriggerParams()}

      <Divider sx={{ my: 2, opacity: 0.3 }} />

      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          mb: 1,
        }}
      >
        <Typography
          variant="subtitle2"
          sx={{ color: theme.palette.text.primary }}
        >
          Actions ({actions.length}/10)
        </Typography>
        <Button
          size="small"
          startIcon={<Add />}
          onClick={handleAddAction}
          disabled={actions.length >= 10}
          data-testid="add-action-button"
        >
          Add Action
        </Button>
      </Box>

      {actions.map((action, index) => (
        <Box
          key={index}
          sx={{
            mb: 1.5,
            p: 1.5,
            borderRadius: "8px",
            backgroundColor: theme.palette.background.default,
            border: `1px solid ${theme.palette.divider}`,
          }}
        >
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1,
            }}
          >
            <FormControl size="small" sx={{ flex: 1 }}>
              <InputLabel>Action Type</InputLabel>
              <Select
                label="Action Type"
                value={action.type}
                onChange={(e) =>
                  handleActionTypeChange(
                    index,
                    e.target.value as AutomationActionType,
                  )
                }
                data-testid={`action-type-select-${index}`}
              >
                {AUTOMATION_ACTION_TYPES.map((at) => (
                  <MenuItem key={at} value={at}>
                    {ACTION_LABELS[at]}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <IconButton
              size="small"
              onClick={() => handleRemoveAction(index)}
              disabled={actions.length <= 1}
              sx={{ color: theme.palette.error.main }}
              data-testid={`remove-action-${index}`}
            >
              <Delete fontSize="small" />
            </IconButton>
          </Box>
          {renderActionParams(action, index)}
        </Box>
      ))}
    </Box>
  );

  return (
    <>
      <Dialog
        open={open}
        onClose={onClose}
        maxWidth="sm"
        fullWidth
        slotProps={{
          paper: {
            sx: {
              backgroundColor: theme.palette.background.paper,
              borderRadius: "12px",
              minHeight: 400,
            },
          },
        }}
      >
        <DialogTitle
          component="div"
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            color: theme.palette.text.primary,
          }}
        >
          <Typography variant="h6" component="span">
            Automation Rules
          </Typography>
          <IconButton
            size="small"
            onClick={onClose}
            sx={{ color: theme.palette.text.secondary }}
            data-testid="close-automation-dialog"
          >
            <Close />
          </IconButton>
        </DialogTitle>

        <DialogContent dividers sx={{ pt: 2 }}>
          {viewMode === "list" ? renderRuleList() : renderRuleBuilder()}
        </DialogContent>

        {viewMode !== "list" && (
          <DialogActions sx={{ px: 3, py: 2 }}>
            <Button
              onClick={() => {
                setViewMode("list");
                resetBuilder();
              }}
              sx={{ color: theme.palette.text.secondary }}
              data-testid="cancel-rule-button"
            >
              Cancel
            </Button>
            <Button
              variant="contained"
              onClick={handleSave}
              data-testid="save-rule-button"
              sx={{ borderRadius: "8px" }}
            >
              {viewMode === "edit" ? "Update Rule" : "Create Rule"}
            </Button>
          </DialogActions>
        )}
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          onClose={() => setSnackbar((s) => ({ ...s, open: false }))}
          severity={snackbar.severity}
          variant="filled"
          sx={{ width: "100%" }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </>
  );
};

export default AutomationRulesDialog;
