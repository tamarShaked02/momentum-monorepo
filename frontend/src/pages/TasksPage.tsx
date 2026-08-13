import React, { useEffect, useState } from "react";
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Chip,
  Fade,
  IconButton,
} from "@mui/material";
import DatePickerInput from "../components/calendar/DatePickerInput";
import { Add, CheckCircle, Delete } from "@mui/icons-material";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
  type DragOverEvent,
  useDroppable,
} from "@dnd-kit/core";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import api from "../api/client";
import type { Task } from "../types";

const statusColumns = [
  { key: "pending", label: "To Do", color: "#FFB74D" },
  { key: "in_progress", label: "In Progress", color: "#4FC3F7" },
  { key: "done", label: "Completed", color: "#66BB6A" },
];

const priorityColors: Record<string, string> = {
  high: "#FF6B6B",
  medium: "#FFB74D",
  low: "#66BB6A",
};

// ── Task Card ───────────────────────────────────────────────────────────────

const TaskCard: React.FC<{
  task: Task;
  onDelete: (id: string) => void;
  overlay?: boolean;
}> = ({ task, onDelete, overlay }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  return (
    <Card
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      sx={{
        borderRadius: 1,
        cursor: "grab",
        flexShrink: 0,
        opacity: isDragging && !overlay ? 0.3 : 1,
        transform: CSS.Transform.toString(transform),
        transition: transition || "transform 0.15s ease, box-shadow 0.15s ease",
        boxShadow: overlay ? "0 8px 24px rgba(0,0,0,0.4)" : "none",
        "&:hover": {
          boxShadow:
            "0 4px 20px rgba(79,195,247,0.25), 0 0 0 1px rgba(79,195,247,0.1)",
          transform: isDragging
            ? CSS.Transform.toString(transform)
            : "translateY(-2px)",
        },
      }}
    >
      <CardContent sx={{ p: 2, "&:last-child": { pb: 2 } }}>
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "start",
            mb: 1,
          }}
        >
          <Typography variant="body2" sx={{ fontWeight: 600, flexGrow: 1 }}>
            {task.title}
          </Typography>
          <IconButton
            size="small"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              onDelete(task.id);
            }}
            sx={{ color: "rgba(255,255,255,0.3)", p: 0.3 }}
          >
            <Delete fontSize="small" />
          </IconButton>
        </Box>
        {task.description && (
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: "block", mb: 1 }}
          >
            {task.description}
          </Typography>
        )}
        <Box
          sx={{
            display: "flex",
            gap: 0.5,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <Chip
            label={task.priority}
            size="small"
            sx={{
              fontSize: "0.65rem",
              height: 20,
              background: `${priorityColors[task.priority]}22`,
              color: priorityColors[task.priority],
            }}
          />
          {task.category && (
            <Chip
              label={task.category}
              size="small"
              variant="outlined"
              sx={{
                fontSize: "0.65rem",
                height: 20,
                borderColor: "rgba(255,255,255,0.1)",
              }}
            />
          )}
          {task.dueDate && (
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ ml: "auto" }}
            >
              {new Date(task.dueDate).toLocaleDateString()}
            </Typography>
          )}
        </Box>
      </CardContent>
    </Card>
  );
};

// ── Droppable Column ────────────────────────────────────────────────────────

const DroppableColumn: React.FC<{
  col: { key: string; label: string; color: string };
  tasks: Task[];
  onDelete: (id: string) => void;
  isOver: boolean;
}> = ({ col, tasks, onDelete, isOver }) => {
  const { setNodeRef } = useDroppable({ id: col.key });

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        minWidth: 0,
        minHeight: 0,
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2, px: 1 }}>
        <Box
          sx={{
            width: 10,
            height: 10,
            borderRadius: "50%",
            background: col.color,
          }}
        />
        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
          {col.label}
        </Typography>
        <Chip
          label={tasks.length}
          size="small"
          sx={{ ml: "auto", background: `${col.color}22`, color: col.color }}
        />
      </Box>
      <Box
        ref={setNodeRef}
        sx={{
          flex: 1,
          borderRadius: 1,
          background: isOver
            ? "rgba(79,195,247,0.06)"
            : "rgba(255,255,255,0.02)",
          border: isOver
            ? "2px dashed rgba(79,195,247,0.3)"
            : "1px dashed rgba(255,255,255,0.06)",
          overflow: "hidden",
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
          p: 1.5,
          transition: "background 0.2s, border 0.2s",
        }}
      >
        <Box
          sx={{
            flex: 1,
            overflow: "auto",
            display: "flex",
            flexDirection: "column",
            gap: 1.5,
          }}
        >
          {tasks.map((task) => (
            <TaskCard key={task.id} task={task} onDelete={onDelete} />
          ))}
          {tasks.length === 0 && (
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ textAlign: "center", py: 4, opacity: 0.5 }}
            >
              No tasks
            </Typography>
          )}
        </Box>
      </Box>
    </Box>
  );
};

// ── Page ────────────────────────────────────────────────────────────────────

const TasksPage: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [overColumn, setOverColumn] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: "",
    description: "",
    priority: "medium",
    category: "",
    dueDate: "",
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const fetchTasks = () => {
    api
      .get("/tasks")
      .then((res) => {
        setTasks(res.data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    fetchTasks();
    const handleRefresh = () => fetchTasks();
    window.addEventListener("ai_mutation_success", handleRefresh);
    window.addEventListener("tasks-updated", handleRefresh);
    window.addEventListener("data-updated", handleRefresh);
    return () => {
      window.removeEventListener("ai_mutation_success", handleRefresh);
      window.removeEventListener("tasks-updated", handleRefresh);
      window.removeEventListener("data-updated", handleRefresh);
    };
  }, []);

  const handleCreate = async () => {
    if (!form.title) return;
    await api.post("/tasks", { ...form, dueDate: form.dueDate || null });
    setDialogOpen(false);
    setForm({
      title: "",
      description: "",
      priority: "medium",
      category: "",
      dueDate: "",
    });
    fetchTasks();
  };

  const handleDelete = async (id: string) => {
    await api.delete(`/tasks/${id}`);
    fetchTasks();
  };

  const handleDragStart = (event: DragStartEvent) => {
    setActiveTask(tasks.find((t) => t.id === event.active.id) ?? null);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { over } = event;
    if (!over) {
      setOverColumn(null);
      return;
    }
    // Check if over a column directly
    const col = statusColumns.find((c) => c.key === over.id);
    if (col) {
      setOverColumn(col.key);
      return;
    }
    // Over a task — find which column that task is in
    const overTask = tasks.find((t) => t.id === over.id);
    setOverColumn(overTask?.status ?? null);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveTask(null);
    setOverColumn(null);
    const { active, over } = event;
    if (!over) return;

    // Determine target status
    let targetStatus: string | undefined;
    const col = statusColumns.find((c) => c.key === over.id);
    if (col) {
      targetStatus = col.key;
    } else {
      const overTask = tasks.find((t) => t.id === over.id);
      targetStatus = overTask?.status;
    }

    const draggedTask = tasks.find((t) => t.id === active.id);
    if (!draggedTask || !targetStatus || draggedTask.status === targetStatus)
      return;

    // Optimistic update
    setTasks((prev) =>
      prev.map((t) =>
        t.id === active.id ? { ...t, status: targetStatus! } : t,
      ),
    );
    await api.put(`/tasks/${active.id}`, { status: targetStatus });
  };

  const getTasksByStatus = (status: string) =>
    tasks.filter((t) => t.status === status);

  if (loading) return null;

  return (
    <Fade in timeout={500}>
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          height: "100%",
          overflow: "hidden",
        }}
      >
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            mb: 2,
            flexShrink: 0,
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <CheckCircle sx={{ color: "#66BB6A", fontSize: 32 }} />
            <Typography variant="h4">Tasks</Typography>
          </Box>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={() => setDialogOpen(true)}
          >
            Add Task
          </Button>
        </Box>

        <DndContext
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" },
              gridTemplateRows: "1fr",
              gap: 3,
              flex: 1,
              minHeight: 0,
              overflow: "hidden",
            }}
          >
            {statusColumns.map((col) => (
              <DroppableColumn
                key={col.key}
                col={col}
                tasks={getTasksByStatus(col.key)}
                onDelete={handleDelete}
                isOver={overColumn === col.key}
              />
            ))}
          </Box>
          <DragOverlay>
            {activeTask && (
              <TaskCard task={activeTask} onDelete={() => {}} overlay />
            )}
          </DragOverlay>
        </DndContext>

        <Dialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          maxWidth="sm"
          fullWidth
          slotProps={{
            paper: { sx: { background: "#1a1f3a", borderRadius: 4 } },
          }}
        >
          <DialogTitle>Add Task</DialogTitle>
          <DialogContent
            sx={{
              display: "flex",
              flexDirection: "column",
              gap: 2.5,
              pt: "16px !important",
            }}
          >
            <TextField
              label="Title"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              fullWidth
              required
            />
            <TextField
              label="Description"
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
              multiline
              rows={2}
              fullWidth
            />
            <Box sx={{ display: "flex", gap: 2 }}>
              <TextField
                label="Priority"
                select
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: e.target.value })}
                fullWidth
              >
                <MenuItem value="low">Low</MenuItem>
                <MenuItem value="medium">Medium</MenuItem>
                <MenuItem value="high">High</MenuItem>
              </TextField>
              <TextField
                label="Category"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                fullWidth
                placeholder="e.g., operational"
              />
            </Box>
              <DatePickerInput
                label="Due Date"
                value={form.dueDate}
                onChange={(val) => setForm({ ...form, dueDate: val })}
                type="date"
                fullWidth
              />
          </DialogContent>
          <DialogActions sx={{ p: 3 }}>
            <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button variant="contained" onClick={handleCreate}>
              Add Task
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </Fade>
  );
};

export default TasksPage;
