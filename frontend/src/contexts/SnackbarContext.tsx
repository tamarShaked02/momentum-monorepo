import React, { createContext, useContext, useState, useCallback } from "react";
import {
  Snackbar,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Button,
} from "@mui/material";

interface SnackbarContextType {
  showSuccess: (msg: string) => void;
  showError: (msg: string) => void;
  showConfirm: (msg: string) => Promise<boolean>;
}

const SnackbarContext = createContext<SnackbarContextType | null>(null);

export const useSnackbar = (): SnackbarContextType => {
  const ctx = useContext(SnackbarContext);
  if (!ctx) throw new Error("useSnackbar must be used within SnackbarProvider");
  return ctx;
};

export const SnackbarProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [snackbar, setSnackbar] = useState<{
    open: boolean;
    message: string;
    severity: "success" | "error";
  }>({ open: false, message: "", severity: "success" });

  const [confirm, setConfirm] = useState<{
    open: boolean;
    message: string;
    resolve: ((value: boolean) => void) | null;
  }>({ open: false, message: "", resolve: null });

  const showSuccess = useCallback((msg: string) => {
    setSnackbar({ open: true, message: msg, severity: "success" });
  }, []);

  const showError = useCallback((msg: string) => {
    setSnackbar({ open: true, message: msg, severity: "error" });
  }, []);

  const showConfirm = useCallback((msg: string): Promise<boolean> => {
    return new Promise((resolve) => {
      setConfirm({ open: true, message: msg, resolve });
    });
  }, []);

  const handleSnackbarClose = () => {
    setSnackbar((prev) => ({ ...prev, open: false }));
  };

  const handleConfirmClose = (result: boolean) => {
    confirm.resolve?.(result);
    setConfirm({ open: false, message: "", resolve: null });
  };

  return (
    <SnackbarContext.Provider value={{ showSuccess, showError, showConfirm }}>
      {children}

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={handleSnackbarClose}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          onClose={handleSnackbarClose}
          severity={snackbar.severity}
          variant="filled"
          sx={{ width: "100%" }}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>

      <Dialog
        open={confirm.open}
        onClose={() => handleConfirmClose(false)}
        slotProps={{
          paper: {
            sx: {
              background: "#1a1f3a",
              backgroundImage: "none",
              borderRadius: 3,
            },
          },
        }}
      >
        <DialogTitle>Confirm</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ color: "text.secondary" }}>
            {confirm.message}
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => handleConfirmClose(false)}>Cancel</Button>
          <Button
            variant="contained"
            color="error"
            onClick={() => handleConfirmClose(true)}
          >
            Confirm
          </Button>
        </DialogActions>
      </Dialog>
    </SnackbarContext.Provider>
  );
};
