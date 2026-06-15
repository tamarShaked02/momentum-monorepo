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
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Divider,
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
  ArrowUpward,
  ArrowDownward,
  Check,
} from "@mui/icons-material";
import type { Pipeline } from "../../types/crm";
import {
  getPipelines,
  createPipeline,
  updatePipeline,
  deletePipeline,
  addStage,
  updateStage,
  deleteStage,
} from "../../api/crm";

export interface PipelineSettingsProps {
  open: boolean;
  onClose: () => void;
}

type ViewMode = "list" | "stages";

const PipelineSettings: React.FC<PipelineSettingsProps> = ({
  open,
  onClose,
}) => {
  const theme = useTheme();

  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [selectedPipeline, setSelectedPipeline] = useState<Pipeline | null>(
    null,
  );

  // Pipeline creation/rename
  const [newPipelineName, setNewPipelineName] = useState("");
  const [creatingPipeline, setCreatingPipeline] = useState(false);
  const [renamingPipelineId, setRenamingPipelineId] = useState<string | null>(
    null,
  );
  const [renamePipelineValue, setRenamePipelineValue] = useState("");

  // Stage management
  const [newStageName, setNewStageName] = useState("");
  const [renamingStageId, setRenamingStageId] = useState<string | null>(null);
  const [renameStageValue, setRenameStageValue] = useState("");

  // Snackbar
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: "success" | "error";
  }>({ open: false, message: "", severity: "success" });

  const fetchPipelines = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getPipelines();
      setPipelines(data);
    } catch {
      setSnackbar({
        open: true,
        message: "Failed to load pipelines.",
        severity: "error",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      fetchPipelines();
      setViewMode("list");
      setSelectedPipeline(null);
      setCreatingPipeline(false);
      setRenamingPipelineId(null);
    }
  }, [open, fetchPipelines]);

  // --- Pipeline CRUD ---

  const handleCreatePipeline = async () => {
    const name = newPipelineName.trim();
    if (!name) {
      setSnackbar({
        open: true,
        message: "Pipeline name is required.",
        severity: "error",
      });
      return;
    }

    try {
      await createPipeline({
        name,
        stages: [
          { name: "Lead", position: 0 },
          {
            name: "Closed Won",
            position: 1,
            isTerminal: true,
            dealStatus: "won",
          },
        ],
      });
      setSnackbar({
        open: true,
        message: "Pipeline created successfully.",
        severity: "success",
      });
      setNewPipelineName("");
      setCreatingPipeline(false);
      fetchPipelines();
    } catch {
      setSnackbar({
        open: true,
        message: "Failed to create pipeline.",
        severity: "error",
      });
    }
  };

  const handleRenamePipeline = async (pipelineId: string) => {
    const name = renamePipelineValue.trim();
    if (!name) {
      setSnackbar({
        open: true,
        message: "Pipeline name is required.",
        severity: "error",
      });
      return;
    }

    try {
      await updatePipeline(pipelineId, { name });
      setSnackbar({
        open: true,
        message: "Pipeline renamed.",
        severity: "success",
      });
      setRenamingPipelineId(null);
      setRenamePipelineValue("");
      fetchPipelines();
    } catch {
      setSnackbar({
        open: true,
        message: "Failed to rename pipeline.",
        severity: "error",
      });
    }
  };

  const handleDeletePipeline = async (pipelineId: string) => {
    try {
      await deletePipeline(pipelineId);
      setSnackbar({
        open: true,
        message: "Pipeline deleted.",
        severity: "success",
      });
      fetchPipelines();
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : "Failed to delete pipeline. It may still have deals.";
      setSnackbar({
        open: true,
        message,
        severity: "error",
      });
    }
  };

  // --- Stage CRUD ---

  const handleSelectPipeline = (pipeline: Pipeline) => {
    setSelectedPipeline(pipeline);
    setViewMode("stages");
  };

  const handleAddStage = async () => {
    if (!selectedPipeline) return;
    const name = newStageName.trim();
    if (!name) {
      setSnackbar({
        open: true,
        message: "Stage name is required.",
        severity: "error",
      });
      return;
    }

    const stages = selectedPipeline.stages ?? [];
    const nextPosition =
      stages.length > 0 ? Math.max(...stages.map((s) => s.position)) + 1 : 0;

    try {
      await addStage(selectedPipeline.id, { name, position: nextPosition });
      setSnackbar({
        open: true,
        message: "Stage added.",
        severity: "success",
      });
      setNewStageName("");
      await refreshSelectedPipeline();
    } catch {
      setSnackbar({
        open: true,
        message: "Failed to add stage.",
        severity: "error",
      });
    }
  };

  const handleRenameStage = async (stageId: string) => {
    if (!selectedPipeline) return;
    const name = renameStageValue.trim();
    if (!name) {
      setSnackbar({
        open: true,
        message: "Stage name is required.",
        severity: "error",
      });
      return;
    }

    try {
      await updateStage(selectedPipeline.id, stageId, { name });
      setSnackbar({
        open: true,
        message: "Stage renamed.",
        severity: "success",
      });
      setRenamingStageId(null);
      setRenameStageValue("");
      await refreshSelectedPipeline();
    } catch {
      setSnackbar({
        open: true,
        message: "Failed to rename stage.",
        severity: "error",
      });
    }
  };

  const handleReorderStage = async (
    stageId: string,
    direction: "up" | "down",
  ) => {
    if (!selectedPipeline) return;
    const stages = [...(selectedPipeline.stages ?? [])].sort(
      (a, b) => a.position - b.position,
    );
    const idx = stages.findIndex((s) => s.id === stageId);
    if (idx < 0) return;

    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= stages.length) return;

    const currentStage = stages[idx];
    const swapStage = stages[swapIdx];

    try {
      await updateStage(selectedPipeline.id, currentStage.id, {
        position: swapStage.position,
      });
      await updateStage(selectedPipeline.id, swapStage.id, {
        position: currentStage.position,
      });
      setSnackbar({
        open: true,
        message: "Stage reordered.",
        severity: "success",
      });
      await refreshSelectedPipeline();
    } catch {
      setSnackbar({
        open: true,
        message: "Failed to reorder stage.",
        severity: "error",
      });
    }
  };

  const handleDeleteStage = async (stageId: string) => {
    if (!selectedPipeline) return;

    try {
      await deleteStage(selectedPipeline.id, stageId);
      setSnackbar({
        open: true,
        message: "Stage deleted.",
        severity: "success",
      });
      await refreshSelectedPipeline();
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : "Failed to delete stage. It may still have deals assigned.";
      setSnackbar({
        open: true,
        message,
        severity: "error",
      });
    }
  };

  const refreshSelectedPipeline = async () => {
    const data = await getPipelines();
    setPipelines(data);
    if (selectedPipeline) {
      const updated = data.find((p) => p.id === selectedPipeline.id);
      if (updated) setSelectedPipeline(updated);
    }
  };

  // --- Render Pipeline List ---

  const renderPipelineList = () => (
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
          Pipelines ({pipelines.length})
        </Typography>
        <Button
          variant="contained"
          size="small"
          startIcon={<Add />}
          onClick={() => setCreatingPipeline(true)}
          data-testid="create-pipeline-button"
          sx={{ borderRadius: "8px" }}
        >
          New Pipeline
        </Button>
      </Box>

      {creatingPipeline && (
        <Box sx={{ display: "flex", gap: 1, mb: 2 }}>
          <TextField
            size="small"
            label="Pipeline Name"
            value={newPipelineName}
            onChange={(e) => setNewPipelineName(e.target.value)}
            slotProps={{ htmlInput: { maxLength: 100 } }}
            data-testid="new-pipeline-name-input"
            sx={{ flex: 1 }}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreatePipeline();
            }}
          />
          <Button
            variant="contained"
            size="small"
            onClick={handleCreatePipeline}
            data-testid="confirm-create-pipeline"
            sx={{ borderRadius: "8px" }}
          >
            Create
          </Button>
          <Button
            size="small"
            onClick={() => {
              setCreatingPipeline(false);
              setNewPipelineName("");
            }}
            sx={{ color: theme.palette.text.secondary }}
          >
            Cancel
          </Button>
        </Box>
      )}

      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
          <CircularProgress size={28} />
        </Box>
      ) : pipelines.length === 0 ? (
        <Typography
          variant="body2"
          sx={{
            color: theme.palette.text.secondary,
            textAlign: "center",
            py: 4,
          }}
        >
          No pipelines yet. Create one to get started.
        </Typography>
      ) : (
        <List disablePadding>
          {pipelines.map((pipeline) => (
            <React.Fragment key={pipeline.id}>
              <ListItem
                sx={{
                  borderRadius: "8px",
                  mb: 0.5,
                  backgroundColor: theme.palette.background.default,
                  cursor: "pointer",
                  "&:hover": {
                    backgroundColor: theme.palette.action.hover,
                  },
                }}
                onClick={() => handleSelectPipeline(pipeline)}
                data-testid={`pipeline-item-${pipeline.id}`}
              >
                {renamingPipelineId === pipeline.id ? (
                  <Box
                    sx={{
                      display: "flex",
                      gap: 1,
                      flex: 1,
                      alignItems: "center",
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <TextField
                      size="small"
                      value={renamePipelineValue}
                      onChange={(e) => setRenamePipelineValue(e.target.value)}
                      slotProps={{ htmlInput: { maxLength: 100 } }}
                      data-testid={`rename-pipeline-input-${pipeline.id}`}
                      sx={{ flex: 1 }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter")
                          handleRenamePipeline(pipeline.id);
                        if (e.key === "Escape") setRenamingPipelineId(null);
                      }}
                      autoFocus
                    />
                    <IconButton
                      size="small"
                      onClick={() => handleRenamePipeline(pipeline.id)}
                      sx={{ color: theme.palette.success.main }}
                    >
                      <Check fontSize="small" />
                    </IconButton>
                  </Box>
                ) : (
                  <>
                    <ListItemText
                      primary={pipeline.name}
                      secondary={`${(pipeline.stages ?? []).length} stages`}
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
                    <ListItemSecondaryAction sx={{ display: "flex", gap: 0.5 }}>
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          setRenamingPipelineId(pipeline.id);
                          setRenamePipelineValue(pipeline.name);
                        }}
                        sx={{ color: theme.palette.text.secondary }}
                        data-testid={`rename-pipeline-${pipeline.id}`}
                      >
                        <Edit fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeletePipeline(pipeline.id);
                        }}
                        sx={{ color: theme.palette.error.main }}
                        data-testid={`delete-pipeline-${pipeline.id}`}
                      >
                        <Delete fontSize="small" />
                      </IconButton>
                    </ListItemSecondaryAction>
                  </>
                )}
              </ListItem>
              <Divider sx={{ opacity: 0.3 }} />
            </React.Fragment>
          ))}
        </List>
      )}
    </Box>
  );

  // --- Render Stage Management ---

  const renderStageManagement = () => {
    if (!selectedPipeline) return null;

    const stages = [...(selectedPipeline.stages ?? [])].sort(
      (a, b) => a.position - b.position,
    );

    return (
      <Box>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1,
            mb: 2,
          }}
        >
          <Button
            size="small"
            onClick={() => {
              setViewMode("list");
              setSelectedPipeline(null);
            }}
            sx={{ color: theme.palette.text.secondary, minWidth: "auto" }}
            data-testid="back-to-pipelines"
          >
            ← Back
          </Button>
          <Typography
            variant="subtitle1"
            sx={{ color: theme.palette.text.primary }}
          >
            {selectedPipeline.name} — Stages
          </Typography>
        </Box>

        {/* Add stage */}
        <Box sx={{ display: "flex", gap: 1, mb: 2 }}>
          <TextField
            size="small"
            label="New Stage Name"
            value={newStageName}
            onChange={(e) => setNewStageName(e.target.value)}
            slotProps={{ htmlInput: { maxLength: 50 } }}
            data-testid="new-stage-name-input"
            sx={{ flex: 1 }}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAddStage();
            }}
          />
          <Button
            variant="contained"
            size="small"
            startIcon={<Add />}
            onClick={handleAddStage}
            data-testid="add-stage-button"
            sx={{ borderRadius: "8px" }}
          >
            Add
          </Button>
        </Box>

        {stages.length === 0 ? (
          <Typography
            variant="body2"
            sx={{
              color: theme.palette.text.secondary,
              textAlign: "center",
              py: 4,
            }}
          >
            No stages in this pipeline.
          </Typography>
        ) : (
          <List disablePadding>
            {stages.map((stage, idx) => (
              <React.Fragment key={stage.id}>
                <ListItem
                  sx={{
                    borderRadius: "8px",
                    mb: 0.5,
                    backgroundColor: theme.palette.background.default,
                  }}
                  data-testid={`stage-item-${stage.id}`}
                >
                  {renamingStageId === stage.id ? (
                    <Box
                      sx={{
                        display: "flex",
                        gap: 1,
                        flex: 1,
                        alignItems: "center",
                      }}
                    >
                      <TextField
                        size="small"
                        value={renameStageValue}
                        onChange={(e) => setRenameStageValue(e.target.value)}
                        slotProps={{ htmlInput: { maxLength: 50 } }}
                        data-testid={`rename-stage-input-${stage.id}`}
                        sx={{ flex: 1 }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleRenameStage(stage.id);
                          if (e.key === "Escape") setRenamingStageId(null);
                        }}
                        autoFocus
                      />
                      <IconButton
                        size="small"
                        onClick={() => handleRenameStage(stage.id)}
                        sx={{ color: theme.palette.success.main }}
                      >
                        <Check fontSize="small" />
                      </IconButton>
                    </Box>
                  ) : (
                    <>
                      <ListItemText
                        primary={stage.name}
                        secondary={
                          stage.isTerminal
                            ? `Terminal (${stage.dealStatus ?? ""})`
                            : `Position ${stage.position}`
                        }
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
                        sx={{ display: "flex", gap: 0.25 }}
                      >
                        <IconButton
                          size="small"
                          onClick={() => handleReorderStage(stage.id, "up")}
                          disabled={idx === 0}
                          sx={{ color: theme.palette.text.secondary }}
                          data-testid={`move-stage-up-${stage.id}`}
                        >
                          <ArrowUpward fontSize="small" />
                        </IconButton>
                        <IconButton
                          size="small"
                          onClick={() => handleReorderStage(stage.id, "down")}
                          disabled={idx === stages.length - 1}
                          sx={{ color: theme.palette.text.secondary }}
                          data-testid={`move-stage-down-${stage.id}`}
                        >
                          <ArrowDownward fontSize="small" />
                        </IconButton>
                        <IconButton
                          size="small"
                          onClick={() => {
                            setRenamingStageId(stage.id);
                            setRenameStageValue(stage.name);
                          }}
                          sx={{ color: theme.palette.text.secondary }}
                          data-testid={`rename-stage-${stage.id}`}
                        >
                          <Edit fontSize="small" />
                        </IconButton>
                        <IconButton
                          size="small"
                          onClick={() => handleDeleteStage(stage.id)}
                          sx={{ color: theme.palette.error.main }}
                          data-testid={`delete-stage-${stage.id}`}
                        >
                          <Delete fontSize="small" />
                        </IconButton>
                      </ListItemSecondaryAction>
                    </>
                  )}
                </ListItem>
                <Divider sx={{ opacity: 0.3 }} />
              </React.Fragment>
            ))}
          </List>
        )}
      </Box>
    );
  };

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
            Pipeline Settings
          </Typography>
          <IconButton
            size="small"
            onClick={onClose}
            sx={{ color: theme.palette.text.secondary }}
            data-testid="close-pipeline-settings"
          >
            <Close />
          </IconButton>
        </DialogTitle>

        <DialogContent dividers sx={{ pt: 2 }}>
          {viewMode === "list" ? renderPipelineList() : renderStageManagement()}
        </DialogContent>

        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button
            onClick={onClose}
            sx={{ color: theme.palette.text.secondary }}
            data-testid="close-pipeline-settings-action"
          >
            Close
          </Button>
        </DialogActions>
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

export default PipelineSettings;
