import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import Logo from "./Logo";
import {
  Drawer,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Box,
  Typography,
  Divider,
  Avatar,
  useMediaQuery,
  useTheme,
  IconButton,
  Tooltip,
} from "@mui/material";
import {
  Dashboard,
  CalendarMonth,
  People,
  Inventory2,
  CheckCircle,
  Campaign,
  BarChart,
  Logout,
  LightMode,
  DarkMode,
  Settings,
} from "@mui/icons-material";
import { useAuth } from "../contexts/AuthContext";
import { useThemeMode } from "../contexts/ThemeContext";

interface SidebarProps {
  drawerWidth: number;
  mobileOpen: boolean;
  onClose: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({
  drawerWidth,
  mobileOpen,
  onClose,
}) => {
  const { user, logout } = useAuth();
  const { mode, toggleMode } = useThemeMode();
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const config = user?.moduleConfig;

  const navItems = [
    {
      label: "Dashboard",
      icon: <Dashboard />,
      path: "/dashboard",
      always: true,
    },
    {
      label: "Appointments",
      icon: <CalendarMonth />,
      path: "/appointments",
      enabled: config?.schedulingEnabled,
    },
    {
      label: "Customers",
      icon: <People />,
      path: "/crm",
      enabled: config?.crmEnabled,
    },
    {
      label: "Inventory",
      icon: <Inventory2 />,
      path: "/inventory",
      enabled: config?.inventoryEnabled,
    },
    {
      label: "Tasks",
      icon: <CheckCircle />,
      path: "/tasks",
      enabled: config?.tasksEnabled,
    },
    {
      label: "Marketing",
      icon: <Campaign />,
      path: "/marketing",
      enabled: config?.marketingEnabled,
    },
    {
      label: "Analytics",
      icon: <BarChart />,
      path: "/analytics",
      enabled: config?.analyticsEnabled,
    },
  ];

  const visibleItems = navItems.filter((item) => item.always || item.enabled);

  const handleNav = (path: string) => {
    navigate(path);
    if (isMobile) onClose();
  };

  const drawerContent = (
    <Box
      sx={{ display: "flex", flexDirection: "column", height: "100%", pt: 2 }}
    >
      {/* Logo */}
      <Box
        sx={{ px: 3, pb: 2, display: "flex", alignItems: "center", gap: 1.5 }}
      >
        <Logo iconSize={28} variant="h5" />
        <Tooltip
          title={mode === "dark" ? "Light mode" : "Dark mode"}
          placement="right"
        >
          <IconButton
            size="small"
            onClick={toggleMode}
            sx={{ ml: "auto", color: "text.secondary" }}
          >
            {mode === "dark" ? (
              <LightMode fontSize="small" />
            ) : (
              <DarkMode fontSize="small" />
            )}
          </IconButton>
        </Tooltip>
      </Box>

      <Divider sx={{ borderColor: "rgba(255,255,255,0.06)", mb: 1 }} />

      {/* User Info */}
      <Box
        sx={{ px: 3, py: 2, display: "flex", alignItems: "center", gap: 1.5 }}
      >
        <Avatar
          sx={{
            width: 36,
            height: 36,
            background: "linear-gradient(135deg, #4FC3F7, #0288D1)",
            fontSize: 16,
            fontWeight: 700,
          }}
        >
          {user?.businessName?.[0]?.toUpperCase() ||
            user?.email?.[0]?.toUpperCase() ||
            "M"}
        </Avatar>
        <Box sx={{ overflow: "hidden", flex: 1 }}>
          <Typography variant="body2" fontWeight={600} noWrap>
            {user?.businessName || "My Business"}
          </Typography>
          <Typography variant="caption" color="text.secondary" noWrap>
            {user?.email}
          </Typography>
        </Box>
        <Tooltip title="Settings" placement="right">
          <IconButton
            size="small"
            onClick={() => handleNav("/settings")}
            sx={{
              color:
                location.pathname === "/settings"
                  ? "#4FC3F7"
                  : "text.secondary",
              "&:hover": { background: "rgba(79, 195, 247, 0.08)" },
            }}
          >
            <Settings fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>

      <Divider sx={{ borderColor: "rgba(255,255,255,0.06)", mb: 1 }} />

      {/* Nav Items */}
      <List sx={{ px: 1.5, flexGrow: 1 }}>
        {visibleItems.map((item) => (
          <ListItemButton
            key={item.path}
            onClick={() => handleNav(item.path)}
            selected={location.pathname === item.path}
            sx={{
              borderRadius: 2,
              mb: 0.5,
              py: 1.2,
              "&.Mui-selected": {
                background: "rgba(79, 195, 247, 0.12)",
                "& .MuiListItemIcon-root": { color: "#4FC3F7" },
                "& .MuiListItemText-primary": {
                  color: "#4FC3F7",
                  fontWeight: 600,
                },
              },
              "&:hover": { background: "rgba(79, 195, 247, 0.06)" },
            }}
          >
            <ListItemIcon sx={{ minWidth: 40, color: "text.secondary" }}>
              {item.icon}
            </ListItemIcon>
            <ListItemText
              primary={item.label}
              slotProps={{ primary: { sx: { fontSize: "0.9rem" } } }}
            />
          </ListItemButton>
        ))}
      </List>

      <Divider sx={{ borderColor: "rgba(255,255,255,0.06)" }} />
      <List sx={{ px: 1.5, pb: 2 }}>
        <ListItemButton
          onClick={() => {
            logout();
            navigate("/login");
          }}
          sx={{
            borderRadius: 2,
            py: 1.2,
            "&:hover": { background: "rgba(255,107,107,0.08)" },
          }}
        >
          <ListItemIcon sx={{ minWidth: 40, color: "#FF6B6B" }}>
            <Logout />
          </ListItemIcon>
          <ListItemText
            primary="Logout"
            slotProps={{
              primary: { sx: { fontSize: "0.9rem", color: "#FF6B6B" } },
            }}
          />
        </ListItemButton>
      </List>
    </Box>
  );

  return isMobile ? (
    <Drawer
      variant="temporary"
      open={mobileOpen}
      onClose={onClose}
      ModalProps={{ keepMounted: true }}
      sx={{ "& .MuiDrawer-paper": { width: drawerWidth } }}
    >
      {drawerContent}
    </Drawer>
  ) : (
    <Drawer
      variant="permanent"
      sx={{ "& .MuiDrawer-paper": { width: drawerWidth } }}
    >
      {drawerContent}
    </Drawer>
  );
};

export default Sidebar;
