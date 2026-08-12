import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  Chip,
  FormControl,
  InputAdornment,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
} from "@mui/material";
import { Add, Search } from "@mui/icons-material";
import {
  DataGrid,
  type GridColDef,
  type GridPaginationModel,
  type GridSortModel,
} from "@mui/x-data-grid";
import { getContacts } from "../../api/crm";
import type {
  Contact,
  ContactListParams,
  LifecycleStage,
} from "../../types/crm";
import { LIFECYCLE_STAGES } from "../../types/crm";

const PAGE_SIZE = 20;

const LIFECYCLE_STAGE_LABELS: Record<LifecycleStage, string> = {
  lead: "Lead",
  prospect: "Prospect",
  customer: "Customer",
  vip: "VIP",
  churned: "Churned",
};

const LIFECYCLE_STAGE_COLORS: Record<LifecycleStage, string> = {
  lead: "info",
  prospect: "warning",
  customer: "success",
  vip: "secondary",
  churned: "error",
};

interface ContactsTabProps {
  onContactClick?: (contact: Contact) => void;
  onAddContact?: () => void;
}

const ContactsTab: React.FC<ContactsTabProps> = ({
  onContactClick,
  onAddContact,
}) => {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  // Filter state
  const [search, setSearch] = useState("");
  const [lifecycleFilter, setLifecycleFilter] = useState<string>("all");
  const [tagFilter, setTagFilter] = useState<string>("");

  // Pagination state
  const [paginationModel, setPaginationModel] = useState<GridPaginationModel>({
    page: 0,
    pageSize: PAGE_SIZE,
  });

  // Sort state
  const [sortModel, setSortModel] = useState<GridSortModel>([]);

  const fetchContacts = useCallback(async () => {
    setLoading(true);
    try {
      const params: ContactListParams = {
        page: paginationModel.page + 1, // API is 1-indexed
        pageSize: paginationModel.pageSize,
      };

      if (search.trim()) {
        params.search = search.trim();
      }

      if (lifecycleFilter !== "all") {
        params.lifecycleStage = lifecycleFilter as LifecycleStage;
      }

      if (tagFilter.trim()) {
        params.tag = tagFilter.trim();
      }

      if (sortModel.length > 0) {
        params.sortBy = sortModel[0].field;
        params.sortOrder = sortModel[0].sort ?? "asc";
      }

      const response = await getContacts(params);
      setContacts(response.data);
      setTotal(response.total);
    } catch (error) {
      console.error("Failed to fetch contacts:", error);
      setContacts([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [paginationModel, search, lifecycleFilter, tagFilter, sortModel]);

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  // Debounce search input
  const [searchInput, setSearchInput] = useState("");

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput);
      setPaginationModel((prev) => ({ ...prev, page: 0 }));
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const handleLifecycleFilterChange = (value: string) => {
    setLifecycleFilter(value);
    setPaginationModel((prev) => ({ ...prev, page: 0 }));
  };

  const handleTagFilterChange = (value: string) => {
    setTagFilter(value);
    setPaginationModel((prev) => ({ ...prev, page: 0 }));
  };

  const columns: GridColDef[] = useMemo(
    () => [
      {
        field: "name",
        headerName: "Name",
        flex: 1.5,
        minWidth: 150,
        sortable: true,
        renderCell: (params) => (
          <Box sx={{ display: "flex", alignItems: "center", height: "100%" }}>
            <Typography variant="body2" sx={{ fontWeight: 600, color: "text.primary" }} noWrap>
              {params.value || "—"}
            </Typography>
          </Box>
        ),
      },
      {
        field: "email",
        headerName: "Email",
        flex: 1.5,
        minWidth: 180,
        sortable: true,
        renderCell: (params) => (
          <Box sx={{ display: "flex", alignItems: "center", height: "100%" }}>
            <Typography variant="body2" sx={{ color: "text.secondary" }} noWrap>
              {params.value || "—"}
            </Typography>
          </Box>
        ),
      },
      {
        field: "company",
        headerName: "Company",
        flex: 1,
        minWidth: 130,
        sortable: true,
        renderCell: (params) => (
          <Box sx={{ display: "flex", alignItems: "center", height: "100%" }}>
            <Typography variant="body2" noWrap>
              {params.value || "—"}
            </Typography>
          </Box>
        ),
      },
      {
        field: "lifecycleStage",
        headerName: "Lifecycle Stage",
        flex: 1,
        minWidth: 140,
        sortable: true,
        renderCell: (params) => {
          const stage = params.value as LifecycleStage;
          return (
            <Box sx={{ display: "flex", alignItems: "center", height: "100%" }}>
              <Chip
                label={LIFECYCLE_STAGE_LABELS[stage] || stage}
                color={
                  (LIFECYCLE_STAGE_COLORS[stage] as
                    | "info"
                    | "warning"
                    | "success"
                    | "secondary"
                    | "error") || "default"
                }
                size="small"
                variant="outlined"
              />
            </Box>
          );
        },
      },
      {
        field: "tags",
        headerName: "Tags",
        flex: 1.2,
        minWidth: 150,
        sortable: false,
        renderCell: (params) => {
          const tags = params.row.tags || [];
          if (tags.length === 0) return "—";
          return (
            <Box sx={{ display: "flex", gap: 0.5, alignItems: "center", flexWrap: "nowrap", height: "100%" }}>
              {tags
                .slice(0, 3)
                .map(
                  (ct: {
                    tag?: { id: string; name: string; color: string | null };
                    tagId: string;
                  }) => (
                    <Chip
                      key={ct.tag?.id || ct.tagId}
                      label={ct.tag?.name || "Tag"}
                      size="small"
                      sx={{
                        height: 20,
                        fontSize: "0.7rem",
                        bgcolor: ct.tag?.color
                          ? `${ct.tag.color}20`
                          : "action.hover",
                        color: ct.tag?.color || "text.secondary",
                        borderColor: ct.tag?.color || "divider",
                      }}
                      variant="outlined"
                    />
                  ),
                )}
              {tags.length > 3 && (
                <Chip
                  label={`+${tags.length - 3}`}
                  size="small"
                  sx={{ height: 20, fontSize: "0.7rem" }}
                  variant="outlined"
                />
              )}
            </Box>
          );
        },
      },
      {
        field: "createdAt",
        headerName: "Created At",
        flex: 1,
        minWidth: 120,
        sortable: true,
        renderCell: (params) => (
          <Box sx={{ display: "flex", alignItems: "center", height: "100%" }}>
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              {new Date(params.value).toLocaleDateString()}
            </Typography>
          </Box>
        ),
      },
    ],
    [],
  );

  return (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Toolbar: Search, Filters, Add button */}
      <Box
        sx={{
          display: "flex",
          flexWrap: "wrap",
          gap: 2,
          mb: 2,
          alignItems: "center",
        }}
      >
        {/* Search bar */}
        <TextField
          size="small"
          placeholder="Search by name, email, phone, company..."
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          sx={{ minWidth: 280, flex: 1, maxWidth: 400 }}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <Search sx={{ color: "text.secondary" }} />
                </InputAdornment>
              ),
            },
          }}
        />

        {/* Lifecycle stage filter */}
        <FormControl size="small" sx={{ minWidth: 160 }}>
          <InputLabel>Lifecycle Stage</InputLabel>
          <Select
            value={lifecycleFilter}
            label="Lifecycle Stage"
            onChange={(e) => handleLifecycleFilterChange(e.target.value)}
          >
            <MenuItem value="all">All Stages</MenuItem>
            {LIFECYCLE_STAGES.map((stage) => (
              <MenuItem key={stage} value={stage}>
                {LIFECYCLE_STAGE_LABELS[stage]}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {/* Tag filter */}
        <TextField
          size="small"
          placeholder="Filter by tag..."
          value={tagFilter}
          onChange={(e) => handleTagFilterChange(e.target.value)}
          sx={{ minWidth: 150, maxWidth: 200 }}
        />

        {/* Add Contact button */}
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={onAddContact}
          sx={{ ml: "auto" }}
        >
          Add Contact
        </Button>
      </Box>

      {/* DataGrid */}
      <Box sx={{ flex: 1, minHeight: 0 }}>
        <DataGrid
          rows={contacts}
          columns={columns}
          rowCount={total}
          loading={loading}
          pageSizeOptions={[10, 20, 50]}
          paginationModel={paginationModel}
          onPaginationModelChange={setPaginationModel}
          paginationMode="server"
          sortingMode="server"
          sortModel={sortModel}
          onSortModelChange={setSortModel}
          onRowClick={(params) => onContactClick?.(params.row as Contact)}
          disableRowSelectionOnClick
          disableColumnFilter
          sx={{
            border: "none",
            "& .MuiDataGrid-cell": {
              borderColor: "divider",
              cursor: "pointer",
            },
            "& .MuiDataGrid-columnHeaders": {
              bgcolor: "background.paper",
              borderColor: "divider",
            },
            "& .MuiDataGrid-row:hover": {
              bgcolor: "action.hover",
            },
            "& .MuiDataGrid-footerContainer": {
              borderColor: "divider",
            },
            "& .MuiDataGrid-overlay": {
              bgcolor: "background.default",
            },
          }}
        />
      </Box>
    </Box>
  );
};

export default ContactsTab;
