import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  ButtonGroup,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  InputAdornment,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
  CircularProgress,
  Autocomplete,
} from "@mui/material";
import { ViewKanban, TableChart, Add as AddIcon } from "@mui/icons-material";
import DatePickerInput from "../calendar/DatePickerInput";
import {
  DataGrid,
  type GridColDef,
  type GridSortModel,
} from "@mui/x-data-grid";
import {
  getDeals,
  getPipelines,
  createDeal,
  moveDealToStage,
  getContacts,
} from "../../api/crm";
import type {
  Deal,
  DealListParams,
  DealCreateData,
  Pipeline,
  Stage,
  Contact,
} from "../../types/crm";
import { useSnackbar } from "../../contexts/SnackbarContext";
import KanbanBoard from "./KanbanBoard";

// ─── Constants ───────────────────────────────────────────────────────────────

const VIEW_STORAGE_KEY = "crm_deals_view";
const FILTER_STORAGE_KEY = "crm_deals_filters";

type ViewMode = "table" | "kanban";

interface DealFilters {
  pipelineId: string;
  stageId: string;
  contactSearch: string;
  minValue: string;
  maxValue: string;
  expectedCloseDateFrom: string;
  expectedCloseDateTo: string;
}

const DEFAULT_FILTERS: DealFilters = {
  pipelineId: "",
  stageId: "",
  contactSearch: "",
  minValue: "",
  maxValue: "",
  expectedCloseDateFrom: "",
  expectedCloseDateTo: "",
};

// ─── Helper: read persisted view ─────────────────────────────────────────────

function getPersistedView(): ViewMode {
  try {
    const stored = localStorage.getItem(VIEW_STORAGE_KEY);
    if (stored === "kanban" || stored === "table") return stored;
  } catch {
    // localStorage unavailable
  }
  return "table";
}

function getPersistedFilters(): DealFilters {
  try {
    const stored = localStorage.getItem(FILTER_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return { ...DEFAULT_FILTERS, ...parsed };
    }
  } catch {
    // localStorage unavailable or invalid JSON
  }
  return DEFAULT_FILTERS;
}

// ─── Component ───────────────────────────────────────────────────────────────

const DealsTab: React.FC = () => {
  const { showSuccess, showError } = useSnackbar();

  // View mode
  const [viewMode, setViewMode] = useState<ViewMode>(getPersistedView);

  // Filter state
  const [filters, setFilters] = useState<DealFilters>(getPersistedFilters);

  // Data state
  const [deals, setDeals] = useState<Deal[]>([]);
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [totalDeals, setTotalDeals] = useState(0);
  const [loading, setLoading] = useState(false);

  // Pagination (table view)
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);

  // Sorting (table view)
  const [sortModel, setSortModel] = useState<GridSortModel>([]);

  // ─── Persist view mode ───────────────────────────────────────────────

  useEffect(() => {
    try {
      localStorage.setItem(VIEW_STORAGE_KEY, viewMode);
    } catch {
      // ignore
    }
  }, [viewMode]);

  // ─── Persist filters ─────────────────────────────────────────────────

  useEffect(() => {
    try {
      localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(filters));
    } catch {
      // ignore
    }
  }, [filters]);

  // ─── Load pipelines & contacts ───────────────────────────────────────

  useEffect(() => {
    let cancelled = false;
    async function loadInitialData() {
      try {
        const [pipelinesData, contactsData] = await Promise.all([
          getPipelines(),
          getContacts({ pageSize: 500 }).catch(() => ({ data: [] })),
        ]);
        if (!cancelled) {
          setPipelines(pipelinesData);
          setContacts(contactsData.data || []);
        }
      } catch (err) {
        console.error("Failed to load initial pipelines or contacts:", err);
      }
    }
    loadInitialData();
    return () => {
      cancelled = true;
    };
  }, []);

  // ─── Derived: stages for selected pipeline ───────────────────────────

  const stagesForPipeline: Stage[] = useMemo(() => {
    if (!filters.pipelineId) return [];
    const pipeline = pipelines.find((p) => p.id === filters.pipelineId);
    return pipeline?.stages ?? [];
  }, [filters.pipelineId, pipelines]);

  // ─── Load deals ──────────────────────────────────────────────────────

  const fetchDeals = useCallback(async () => {
    setLoading(true);
    try {
      const params: DealListParams = {
        page: page + 1, // API is 1-indexed
        pageSize,
      };

      if (filters.pipelineId) params.pipelineId = filters.pipelineId;
      if (filters.stageId) params.stageId = filters.stageId;
      if (filters.minValue) params.minValue = Number(filters.minValue);
      if (filters.maxValue) params.maxValue = Number(filters.maxValue);
      if (filters.contactSearch) params.contactId = filters.contactSearch;

      // Sorting
      if (sortModel.length > 0) {
        params.sortBy = sortModel[0].field;
        params.sortOrder = sortModel[0].sort ?? "asc";
      }

      const response = await getDeals(params);
      setDeals(response.data);
      setTotalDeals(response.total);
    } catch {
      // handle error silently for now
      setDeals([]);
      setTotalDeals(0);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, filters, sortModel]);

  useEffect(() => {
    fetchDeals();
  }, [fetchDeals]);

  // ─── Filter change handlers ──────────────────────────────────────────

  const handleFilterChange = (field: keyof DealFilters, value: string) => {
    setFilters((prev) => {
      const next = { ...prev, [field]: value };
      // Clear stage when pipeline changes
      if (field === "pipelineId") {
        next.stageId = "";
      }
      return next;
    });
    // Reset to first page on filter change
    setPage(0);
  };

  // ─── Kanban: move deal handler ────────────────────────────────────────

  const handleDealMoved = async (dealId: string, stageId: string) => {
    await moveDealToStage(dealId, stageId);
    await fetchDeals();
  };

  // ─── Create Deal dialog state ────────────────────────────────────────

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [dealForm, setDealForm] = useState({
    title: "",
    contactId: "",
    pipelineId: "",
    stageId: "",
    value: "",
    winProbability: "",
    expectedCloseDate: "",
  });
  const [dealSaving, setDealSaving] = useState(false);

  const stagesForDealForm: Stage[] = useMemo(() => {
    if (!dealForm.pipelineId) return [];
    const pipeline = pipelines.find((p) => p.id === dealForm.pipelineId);
    return (pipeline?.stages ?? []).sort((a, b) => a.position - b.position);
  }, [dealForm.pipelineId, pipelines]);

  const handleCreateDeal = async () => {
    if (
      !dealForm.title.trim() ||
      !dealForm.contactId ||
      !dealForm.pipelineId ||
      !dealForm.stageId
    ) {
      console.warn("Create Deal failed validation: Missing required fields", dealForm);
      showError("Please fill in all required fields (Title, Contact, Pipeline, Stage)");
      return;
    }
    setDealSaving(true);
    try {
      let formattedCloseDate: string | undefined = undefined;
      if (dealForm.expectedCloseDate) {
        const parsedDate = new Date(dealForm.expectedCloseDate);
        if (!isNaN(parsedDate.getTime())) {
          formattedCloseDate = parsedDate.toISOString();
        }
      }

      const data: DealCreateData = {
        title: dealForm.title.trim(),
        contactId: dealForm.contactId,
        pipelineId: dealForm.pipelineId,
        stageId: dealForm.stageId,
        value: dealForm.value ? Number(dealForm.value) : undefined,
        winProbability: dealForm.winProbability
          ? Number(dealForm.winProbability)
          : undefined,
        expectedCloseDate: formattedCloseDate,
      };

      console.log("Submitting Create Deal payload:", data);
      await createDeal(data);
      showSuccess("Deal created successfully");
      setCreateDialogOpen(false);
      setDealForm({
        title: "",
        contactId: "",
        pipelineId: "",
        stageId: "",
        value: "",
        winProbability: "",
        expectedCloseDate: "",
      });
      await fetchDeals();
    } catch (error: any) {
      const serverMsg = error?.response?.data?.error || error?.message || "Failed to create deal";
      console.error("Failed to create deal:", error, "Server Response:", error?.response?.data);
      showError(serverMsg);
    } finally {
      setDealSaving(false);
    }
  };

  // ─── DataGrid columns ────────────────────────────────────────────────

  const columns: GridColDef[] = useMemo(
    () => [
      {
        field: "title",
        headerName: "Title",
        flex: 1.5,
        minWidth: 180,
      },
      {
        field: "value",
        headerName: "Value",
        width: 120,
        type: "number",
        valueFormatter: (value: number | null) =>
          value != null ? `$${value.toLocaleString()}` : "—",
      },
      {
        field: "contact",
        headerName: "Contact",
        flex: 1,
        minWidth: 140,
        sortable: false,
        valueGetter: (_value: unknown, row: Deal) => row.contact?.name ?? "—",
      },
      {
        field: "stage",
        headerName: "Stage",
        width: 140,
        sortable: false,
        valueGetter: (_value: unknown, row: Deal) => row.stage?.name ?? "—",
      },
      {
        field: "pipeline",
        headerName: "Pipeline",
        width: 140,
        sortable: false,
        valueGetter: (_value: unknown, row: Deal) => row.pipeline?.name ?? "—",
      },
      {
        field: "winProbability",
        headerName: "Win %",
        width: 90,
        type: "number",
        valueFormatter: (value: number | null) =>
          value != null ? `${value}%` : "—",
      },
      {
        field: "expectedCloseDate",
        headerName: "Expected Close",
        width: 140,
        valueFormatter: (value: string | null) =>
          value ? new Date(value).toLocaleDateString() : "—",
      },
      {
        field: "status",
        headerName: "Status",
        width: 100,
        renderCell: (params) => {
          const colorMap: Record<string, string> = {
            open: "info.main",
            won: "success.main",
            lost: "error.main",
          };
          return (
            <Typography
              variant="caption"
              sx={{
                color: colorMap[params.value] ?? "text.secondary",
                fontWeight: 600,
                textTransform: "capitalize",
              }}
            >
              {params.value}
            </Typography>
          );
        },
      },
    ],
    [],
  );

  // ─── Render: Filter Bar ──────────────────────────────────────────────

  const renderFilterBar = () => (
    <Box
      sx={{
        display: "flex",
        flexWrap: "wrap",
        gap: 1.5,
        alignItems: "center",
        mb: 2,
      }}
    >
      {/* Pipeline filter */}
      <TextField
        select
        label="Pipeline"
        size="small"
        value={filters.pipelineId}
        onChange={(e) => handleFilterChange("pipelineId", e.target.value)}
        sx={{ minWidth: 160 }}
      >
        <MenuItem value="">All Pipelines</MenuItem>
        {pipelines.map((p) => (
          <MenuItem key={p.id} value={p.id}>
            {p.name}
          </MenuItem>
        ))}
      </TextField>

      {/* Stage filter */}
      <TextField
        select
        label="Stage"
        size="small"
        value={filters.stageId}
        onChange={(e) => handleFilterChange("stageId", e.target.value)}
        disabled={!filters.pipelineId}
        sx={{ minWidth: 140 }}
      >
        <MenuItem value="">All Stages</MenuItem>
        {stagesForPipeline.map((s) => (
          <MenuItem key={s.id} value={s.id}>
            {s.name}
          </MenuItem>
        ))}
      </TextField>

      {/* Contact search */}
      <TextField
        label="Contact"
        size="small"
        placeholder="Search contact..."
        value={filters.contactSearch}
        onChange={(e) => handleFilterChange("contactSearch", e.target.value)}
        sx={{ minWidth: 160 }}
      />

      {/* Value range */}
      <TextField
        label="Min Value"
        size="small"
        type="number"
        value={filters.minValue}
        onChange={(e) => handleFilterChange("minValue", e.target.value)}
        sx={{ width: 120 }}
        slotProps={{
          input: {
            startAdornment: <InputAdornment position="start">$</InputAdornment>,
          },
        }}
      />
      <TextField
        label="Max Value"
        size="small"
        type="number"
        value={filters.maxValue}
        onChange={(e) => handleFilterChange("maxValue", e.target.value)}
        sx={{ width: 120 }}
        slotProps={{
          input: {
            startAdornment: <InputAdornment position="start">$</InputAdornment>,
          },
        }}
      />

      {/* Kanban-specific: date range filters */}
      {viewMode === "kanban" && (
        <>
          <Box sx={{ width: 160 }}>
            <DatePickerInput
              label="Close From"
              value={filters.expectedCloseDateFrom}
              onChange={(val) =>
                handleFilterChange("expectedCloseDateFrom", val)
              }
              type="date"
            />
          </Box>
          <Box sx={{ width: 160 }}>
            <DatePickerInput
              label="Close To"
              value={filters.expectedCloseDateTo}
              onChange={(val) =>
                handleFilterChange("expectedCloseDateTo", val)
              }
              type="date"
            />
          </Box>
        </>
      )}
    </Box>
  );

  // ─── Render: Table View ──────────────────────────────────────────────

  const renderTableView = () => (
    <Box sx={{ flex: 1, minHeight: 400 }}>
      <DataGrid
        rows={deals}
        columns={columns}
        rowCount={totalDeals}
        loading={loading}
        paginationMode="server"
        paginationModel={{ page, pageSize }}
        onPaginationModelChange={(model) => {
          setPage(model.page);
          setPageSize(model.pageSize);
        }}
        sortingMode="server"
        sortModel={sortModel}
        onSortModelChange={setSortModel}
        pageSizeOptions={[10, 25, 50]}
        disableRowSelectionOnClick
        sx={{
          border: "none",
          "& .MuiDataGrid-cell": {
            borderColor: "divider",
          },
          "& .MuiDataGrid-columnHeaders": {
            bgcolor: "background.paper",
            borderColor: "divider",
          },
          "& .MuiDataGrid-footerContainer": {
            borderColor: "divider",
          },
        }}
      />
    </Box>
  );

  // ─── Render: Kanban View ───────────────────────────────────────────────

  const renderKanbanView = () => {
    // Need a pipeline selected for Kanban
    const activePipelineId =
      filters.pipelineId || (pipelines.length > 0 ? pipelines[0].id : "");
    const activePipeline = pipelines.find((p) => p.id === activePipelineId);
    const stages = (activePipeline?.stages ?? []).sort(
      (a, b) => a.position - b.position,
    );

    if (loading && deals.length === 0) {
      return (
        <Box
          sx={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            flex: 1,
            minHeight: 300,
          }}
        >
          <CircularProgress />
        </Box>
      );
    }

    if (!activePipeline || stages.length === 0) {
      return (
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flex: 1,
            minHeight: 300,
          }}
        >
          <Typography color="text.secondary">
            No pipeline available. Create a pipeline first.
          </Typography>
        </Box>
      );
    }

    // Filter deals for kanban (only deals in this pipeline)
    const kanbanDeals = deals.filter((d) => d.pipelineId === activePipelineId);

    return (
      <Box sx={{ flex: 1, minHeight: 400, overflow: "hidden" }}>
        <KanbanBoard
          pipelineId={activePipelineId}
          deals={kanbanDeals}
          stages={stages}
          onDealMoved={handleDealMoved}
          filters={{
            contactId: filters.contactSearch || undefined,
            expectedCloseDateFrom: filters.expectedCloseDateFrom || undefined,
            expectedCloseDateTo: filters.expectedCloseDateTo || undefined,
            minValue: filters.minValue ? Number(filters.minValue) : undefined,
          }}
        />
      </Box>
    );
  };

  // ─── Main Render ─────────────────────────────────────────────────────

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Header: View toggle + Create button */}
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          mb: 2,
        }}
      >
        <ButtonGroup size="small" aria-label="Deal view mode">
          <Button
            variant={viewMode === "table" ? "contained" : "outlined"}
            startIcon={<TableChart />}
            onClick={() => setViewMode("table")}
          >
            Table
          </Button>
          <Button
            variant={viewMode === "kanban" ? "contained" : "outlined"}
            startIcon={<ViewKanban />}
            onClick={() => setViewMode("kanban")}
          >
            Kanban
          </Button>
        </ButtonGroup>

        <Button
          variant="contained"
          startIcon={<AddIcon />}
          size="small"
          onClick={() => setCreateDialogOpen(true)}
        >
          Create Deal
        </Button>
      </Box>

      {/* Filter Bar */}
      {renderFilterBar()}

      {/* View Content */}
      {viewMode === "table" ? renderTableView() : renderKanbanView()}

      {/* Create Deal Dialog */}
      <Dialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Create Deal</DialogTitle>
        <DialogContent
          sx={{
            display: "flex",
            flexDirection: "column",
            gap: 2,
            pt: "16px !important",
          }}
        >
          <TextField
            label="Title"
            value={dealForm.title}
            onChange={(e) =>
              setDealForm({ ...dealForm, title: e.target.value })
            }
            required
            size="small"
            fullWidth
          />
          <Autocomplete
            options={contacts}
            getOptionLabel={(option) =>
              typeof option === "string"
                ? option
                : `${option.name}${option.company ? ` (${option.company})` : ""}`
            }
            value={contacts.find((c) => c.id === dealForm.contactId) || null}
            onChange={(_e, newValue) => {
              setDealForm({
                ...dealForm,
                contactId: newValue ? newValue.id : "",
              });
            }}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Contact *"
                placeholder="Select contact"
                size="small"
                required
              />
            )}
            isOptionEqualToValue={(option, value) => option.id === value.id}
            fullWidth
          />
          <Box sx={{ display: "flex", gap: 2 }}>
            <FormControl fullWidth size="small" required>
              <InputLabel>Pipeline</InputLabel>
              <Select
                value={dealForm.pipelineId}
                label="Pipeline"
                onChange={(e) =>
                  setDealForm({
                    ...dealForm,
                    pipelineId: e.target.value,
                    stageId: "",
                  })
                }
              >
                {pipelines.map((p) => (
                  <MenuItem key={p.id} value={p.id}>
                    {p.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl
              fullWidth
              size="small"
              required
              disabled={!dealForm.pipelineId}
            >
              <InputLabel>Stage</InputLabel>
              <Select
                value={dealForm.stageId}
                label="Stage"
                onChange={(e) =>
                  setDealForm({ ...dealForm, stageId: e.target.value })
                }
              >
                {stagesForDealForm.map((s) => (
                  <MenuItem key={s.id} value={s.id}>
                    {s.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
          <Box sx={{ display: "flex", gap: 2 }}>
            <TextField
              label="Value"
              type="number"
              value={dealForm.value}
              onChange={(e) =>
                setDealForm({ ...dealForm, value: e.target.value })
              }
              size="small"
              fullWidth
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">$</InputAdornment>
                  ),
                },
              }}
            />
            <TextField
              label="Win Probability"
              type="number"
              value={dealForm.winProbability}
              onChange={(e) =>
                setDealForm({ ...dealForm, winProbability: e.target.value })
              }
              size="small"
              fullWidth
              slotProps={{
                input: {
                  endAdornment: (
                    <InputAdornment position="end">%</InputAdornment>
                  ),
                },
                htmlInput: { min: 0, max: 100 },
              }}
            />
          </Box>
          <DatePickerInput
            label="Expected Close Date"
            value={dealForm.expectedCloseDate}
            onChange={(val) =>
              setDealForm({ ...dealForm, expectedCloseDate: val })
            }
            type="date"
            fullWidth
          />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button
            onClick={() => setCreateDialogOpen(false)}
            sx={{ color: "text.secondary" }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleCreateDeal}
            disabled={
              !dealForm.title.trim() ||
              !dealForm.contactId ||
              !dealForm.pipelineId ||
              !dealForm.stageId ||
              dealSaving
            }
          >
            {dealSaving ? "Creating..." : "Create Deal"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default DealsTab;
