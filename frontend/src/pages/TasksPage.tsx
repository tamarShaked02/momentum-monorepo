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
import { Add, CheckCircle, Delete } from "@mui/icons-material";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import api from "../api/client";
import type { Task } from "../types";

const statusColumns = [
  { key: "pending", label: "To Do", color: "#FFB74D" },
  { key: "in_progress", label: "In Progress", color: "#4FC3F7" },
  { key: "completed", label: "Completed", color: "#66BB6A" },
];

const priorityColors: Record<string, string> = {
  high: "#FF6B6B",
  medium: "#FFB74D",
  low: "#66BB6A",
};

// ── Sortable Task Card ──────────────────────────────────────────────────────

interface TaskCardProps {
  task: Task;
  onDelete: (id: string) => void;
  overlay?: boolean;
}

const TaskCard: React.FC<TaskCardProps> = ({ task, onDelete, overlay }) => {
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
        borderRadius: 2,
        cursor: "grab",
        opacity: isDragging && !overlay ? 0.35 : 1,
        transform: CSS.Transform.toString(transform),
        transition,
        boxShadow: overlay ? "0 8px 24px rgba(0,0,0,0.4)" : undefined,
        "&:hover": { transform: isDragging ? undefined : "translateY(-1px)" },
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

// ── Column ──────────────────────────────────────────────────────────────────

interface ColumnProps {
  col: { key: string; label: string; color: string };
  tasks: Task[];
  onDelete: (id: string) => void;
}

const Column: React.FC<ColumnProps> = ({ col, tasks, onDelete }) => (
  <Box>
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
    <SortableContext
      items={tasks.map((t) => t.id)}
      strategy={verticalListSortingStrategy}
    >
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          gap: 1.5,
          minHeight: 200,
          p: 1.5,
          borderRadius: 2,
          background: "rgba(255,255,255,0.02)",
          border: "1px dashed rgba(255,255,255,0.06)",
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
    </SortableContext>
  </Box>
);

// ── Page ────────────────────────────────────────────────────────────────────

const TasksPage: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
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
    const task = tasks.find((t) => t.id === event.active.id);
    setActiveTask(task ?? null);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveTask(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    // Determine target column: over could be a column id or a task id
    const targetCol = statusColumns.find((c) => c.key === over.id);
    const targetStatus = targetCol
      ? targetCol.key
      : tasks.find((t) => t.id === over.id)?.status;

    const draggedTask = tasks.find((t) => t.id === active.id);
    if (!draggedTask || !targetStatus || draggedTask.status === targetStatus)
      return;

    // Optimistic update
    setTasks((prev) =>
      prev.map((t) =>
        t.id === active.id ? { ...t, status: targetStatus } : t,
      ),
    );
    await api.put(`/tasks/${active.id}`, { status: targetStatus });
  };

  const getTasksByStatus = (status: string) =>
    tasks.filter((t) => t.status === status);

  if (loading) return null;

  return (
    <Fade in timeout={500}>
      <Box>
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            mb: 3,
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
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" },
              gap: 3,
              minHeight: 400,
            }}
          >
            {statusColumns.map((col) => (
              <Column
                key={col.key}
                col={col}
                tasks={getTasksByStatus(col.key)}
                onDelete={handleDelete}
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
          PaperProps={{ sx: { background: "#1a1f3a", borderRadius: 4 } }}
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
            <Box>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ mb: 0.5, display: "block", pl: 0.5 }}
              >
                Due Date
              </Typography>
              <TextField
                type="date"
                value={form.dueDate}
                onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                fullWidth
              />
            </Box>
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
