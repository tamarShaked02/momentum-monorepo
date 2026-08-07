import React from 'react';
import { Box, Typography, type TypographyProps } from '@mui/material';
import { AutoAwesome } from '@mui/icons-material';

interface LogoProps {
  iconSize?: number;
  variant?: TypographyProps['variant'];
  className?: string;
}

export const Logo: React.FC<LogoProps> = ({
  iconSize = 28,
  variant = 'h5',
  className = 'logo',
}) => {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
      <AutoAwesome sx={{ color: '#4FC3F7', fontSize: iconSize }} />
      <Typography
        variant={variant}
        className={className}
        sx={{
          fontWeight: 800,
          fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          background: 'linear-gradient(135deg, #4FC3F7, #FFB74D)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
        }}
      >
        Momentum
      </Typography>
    </Box>
  );
};

export default Logo;
