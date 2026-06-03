import React, { useState } from "react";
import { Outlet } from "react-router-dom";
import { Box, useMediaQuery, useTheme } from "@mui/material";
import Sidebar from "./Sidebar";
import CommandBar from "./CommandBar";

const DRAWER_WIDTH = 260;

const Layout: React.FC = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const [mobileOpen, setMobileOpen] = useState(false);
  const isDark = theme.palette.mode === "dark";

  return (
    <Box
      sx={{
        display: "flex",
        minHeight: "100vh",
        background: isDark
          ? "linear-gradient(145deg, #0a0e27 0%, #111638 50%, #0d1130 100%)"
          : "linear-gradient(145deg, #f0f2f8 0%, #e8ecf5 100%)",
      }}
    >
      <Sidebar
        drawerWidth={DRAWER_WIDTH}
        mobileOpen={mobileOpen}
        onClose={() => setMobileOpen(false)}
      />
      <Box
        sx={{
          flexGrow: 1,
          display: "flex",
          flexDirection: "column",
          ml: isMobile ? 0 : `${DRAWER_WIDTH}px`,
          transition: "margin 0.3s ease",
        }}
      >
        <CommandBar onMenuClick={() => setMobileOpen(true)} />
        <Box
          component="main"
          sx={{
            flexGrow: 1,
            p: { xs: 2, sm: 3 },
            pt: { xs: 10, sm: 11 },
            overflow: "auto",
          }}
        >
          <Outlet />
        </Box>
      </Box>
    </Box>
  );
};

export default Layout;
