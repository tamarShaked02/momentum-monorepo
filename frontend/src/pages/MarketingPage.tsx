import React, { useState } from 'react';
import { Box, Typography, TextField, Button, Card, CardContent, Chip, ToggleButton, ToggleButtonGroup, Fade, CircularProgress, MenuItem, Divider } from '@mui/material';
import { Campaign, AutoAwesome, Sms, Email, Share } from '@mui/icons-material';
import api from '../api/client';

const MarketingPage: React.FC = () => {
  const [step, setStep] = useState(0); // 0=goal, 1=generate, 2=review
  const [goal, setGoal] = useState('');
  const [brief, setBrief] = useState('');
  const [channels, setChannels] = useState<string[]>(['sms', 'social']);
  const [content, setContent] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [campaignName, setCampaignName] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const goals = [
    { value: 'fill_schedule', label: 'Fill Empty Slots', emoji: '📅' },
    { value: 'promote_product', label: 'Promote Product', emoji: '🎁' },
    { value: 'general_update', label: 'General Update', emoji: '📢' },
  ];

  const handleGenerate = async () => {
    if (!brief.trim()) return;
    setLoading(true);
    try {
      const res = await api.post('/marketing/generate', { brief: `Goal: ${goal}. ${brief}`, channels });
      setContent(res.data);
      setStep(2);
    } catch {
      alert('Failed to generate content.');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.post('/marketing/automations', {
        name: campaignName || `Campaign - ${new Date().toLocaleDateString()}`,
        goal,
        channels,
        smsContent: content?.sms || null,
        emailContent: typeof content?.email === 'object' ? `${content.email.subject}\n\n${content.email.body}` : content?.email || null,
        socialContent: content?.social || null,
      });
      setSaved(true);
    } catch {
      alert('Failed to save campaign.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Fade in timeout={500}>
      <Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 4 }}>
          <Campaign sx={{ color: '#FF7043', fontSize: 32 }} />
          <Typography variant="h4" fontWeight={700}>Campaign Wizard</Typography>
        </Box>

        {/* Step Indicator */}
        <Box sx={{ display: 'flex', gap: 2, mb: 4 }}>
          {['Select Goal', 'Create Content', 'Review & Launch'].map((s, i) => (
            <Chip key={i} label={s} sx={{
              background: step >= i ? 'rgba(79,195,247,0.15)' : 'rgba(255,255,255,0.03)',
              color: step >= i ? '#4FC3F7' : 'text.secondary',
              fontWeight: step === i ? 700 : 400,
              border: step === i ? '1px solid rgba(79,195,247,0.4)' : '1px solid rgba(255,255,255,0.06)',
            }} />
          ))}
        </Box>

        {/* Step 0: Goal Selection */}
        {step === 0 && (
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' }, gap: 2 }}>
            {goals.map(g => (
              <Card key={g.value} onClick={() => { setGoal(g.value); setStep(1); }}
                sx={{ cursor: 'pointer', textAlign: 'center', py: 4, border: '1px solid rgba(255,255,255,0.08)', '&:hover': { borderColor: 'rgba(79,195,247,0.4)', transform: 'translateY(-4px)' } }}>
                <Typography variant="h3" sx={{ mb: 1 }}>{g.emoji}</Typography>
                <Typography variant="h6" fontWeight={600}>{g.label}</Typography>
              </Card>
            ))}
          </Box>
        )}

        {/* Step 1: Content Generation */}
        {step === 1 && (
          <Box sx={{ maxWidth: 600 }}>
            <Card sx={{ p: 3, mb: 3 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <AutoAwesome sx={{ color: '#4FC3F7' }} />
                <Typography variant="h6" fontWeight={600}>Describe Your Campaign</Typography>
              </Box>
              <TextField fullWidth multiline rows={3} placeholder='e.g., "20% off all services this Friday, targeting regular customers"'
                value={brief} onChange={e => setBrief(e.target.value)} sx={{ mb: 3 }} />
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Channels</Typography>
              <ToggleButtonGroup value={channels} onChange={(_, v) => { if (v.length) setChannels(v); }} sx={{ mb: 3 }}>
                <ToggleButton value="sms" sx={{ gap: 0.5 }}><Sms fontSize="small" /> SMS</ToggleButton>
                <ToggleButton value="email" sx={{ gap: 0.5 }}><Email fontSize="small" /> Email</ToggleButton>
                <ToggleButton value="social" sx={{ gap: 0.5 }}><Share fontSize="small" /> Social</ToggleButton>
              </ToggleButtonGroup>
              <Box sx={{ display: 'flex', gap: 2 }}>
                <Button variant="outlined" onClick={() => setStep(0)}>Back</Button>
                <Button variant="contained" onClick={handleGenerate} disabled={loading || !brief.trim()} startIcon={loading ? <CircularProgress size={16} /> : <AutoAwesome />}>
                  {loading ? 'Generating...' : 'Generate Content'}
                </Button>
              </Box>
            </Card>
          </Box>
        )}

        {/* Step 2: Review & Launch */}
        {step === 2 && content && (
          <Box>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' }, gap: 3, mb: 3 }}>
              {channels.includes('sms') && content.sms && (
                <Card sx={{ border: '1px solid rgba(255,183,77,0.3)' }}>
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}><Sms sx={{ color: '#FFB74D' }} /><Typography variant="h6" fontWeight={600}>SMS</Typography></Box>
                    <Typography variant="body2" sx={{ p: 2, background: 'rgba(255,255,255,0.03)', borderRadius: 2, fontStyle: 'italic' }}>{content.sms}</Typography>
                  </CardContent>
                </Card>
              )}
              {channels.includes('email') && content.email && (
                <Card sx={{ border: '1px solid rgba(79,195,247,0.3)' }}>
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}><Email sx={{ color: '#4FC3F7' }} /><Typography variant="h6" fontWeight={600}>Email</Typography></Box>
                    <Typography variant="subtitle2" sx={{ mb: 1, color: '#4FC3F7' }}>Subject: {typeof content.email === 'object' ? content.email.subject : ''}</Typography>
                    <Typography variant="body2" sx={{ p: 2, background: 'rgba(255,255,255,0.03)', borderRadius: 2, whiteSpace: 'pre-wrap' }}>
                      {typeof content.email === 'object' ? content.email.body : content.email}
                    </Typography>
                  </CardContent>
                </Card>
              )}
              {channels.includes('social') && content.social && (
                <Card sx={{ border: '1px solid rgba(186,104,200,0.3)', gridColumn: channels.length < 3 ? 'auto' : '1 / -1' }}>
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}><Share sx={{ color: '#BA68C8' }} /><Typography variant="h6" fontWeight={600}>Social Media</Typography></Box>
                    <Typography variant="body2" sx={{ p: 2, background: 'rgba(255,255,255,0.03)', borderRadius: 2, whiteSpace: 'pre-wrap' }}>{content.social}</Typography>
                  </CardContent>
                </Card>
              )}
            </Box>

            <Divider sx={{ borderColor: 'rgba(255,255,255,0.06)', my: 3 }} />

            {!saved ? (
              <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                <TextField label="Campaign Name" value={campaignName} onChange={e => setCampaignName(e.target.value)} size="small" sx={{ minWidth: 250 }} />
                <Button variant="outlined" onClick={() => { setStep(1); setContent(null); }}>Regenerate</Button>
                <Button variant="contained" onClick={handleSave} disabled={saving} size="large">
                  {saving ? 'Saving...' : '🚀 Save Campaign'}
                </Button>
              </Box>
            ) : (
              <Card sx={{ p: 3, background: 'rgba(102,187,106,0.08)', border: '1px solid rgba(102,187,106,0.3)', textAlign: 'center' }}>
                <Typography variant="h6" sx={{ color: '#66BB6A' }}>✅ Campaign saved successfully!</Typography>
                <Button sx={{ mt: 2 }} onClick={() => { setStep(0); setContent(null); setSaved(false); setBrief(''); setCampaignName(''); }}>Create Another</Button>
              </Card>
            )}
          </Box>
        )}
      </Box>
    </Fade>
  );
};

export default MarketingPage;
