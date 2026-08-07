import React, { useState } from 'react';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import { Box, Card, CardContent, TextField, Button, Typography, Link, Alert, InputAdornment, IconButton } from '@mui/material';
import { Visibility, VisibilityOff } from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import Logo from '../components/Logo';

const RegisterPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    setLoading(true);
    try {
      await register(email, password, businessName || undefined);
      navigate('/onboarding');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(145deg, #0a0e27 0%, #1a1f3a 50%, #0d1130 100%)', p: 2 }}>
      <Card sx={{ maxWidth: 440, width: '100%', p: { xs: 2, sm: 3 } }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, justifyContent: 'center' }}>
            <Logo iconSize={32} variant="h4" />
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', mb: 4 }}>
            Create your account and let AI set up your business.
          </Typography>

          {error && <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>{error}</Alert>}

          <Box component="form" onSubmit={handleSubmit}>
            <TextField fullWidth label="Business Name" value={businessName} onChange={(e) => setBusinessName(e.target.value)} sx={{ mb: 2.5 }} placeholder="e.g., Sarah's Nails" />
            <TextField fullWidth label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} sx={{ mb: 2.5 }} required />
            <TextField fullWidth label="Password" type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} sx={{ mb: 3 }} required
              slotProps={{
                input: {
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton onClick={() => setShowPassword(!showPassword)} edge="end" sx={{ color: 'text.secondary' }}>
                        {showPassword ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ),
                },
              }}
            />
            <Button fullWidth variant="contained" type="submit" disabled={loading} size="large" sx={{ mb: 2, py: 1.5 }}>
              {loading ? 'Creating Account...' : 'Get Started'}
            </Button>
          </Box>

          <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center' }}>
            Already have an account?{' '}
            <Link component={RouterLink} to="/login" sx={{ color: '#4FC3F7', textDecoration: 'none', fontWeight: 600 }}>Sign In</Link>
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
};

export default RegisterPage;
