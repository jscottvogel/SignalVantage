
import React from 'react';
import {
    Drawer, Box, Typography, IconButton, Stack, Divider, Button,
    Chip, Paper
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import type { Schema } from '../../amplify/data/resource';
import { generateExecutiveBriefing } from '../utils/executiveBriefing';

interface Props {
    open: boolean;
    onClose: () => void;
    objectives: Schema["StrategicObjective"]["type"][];
}

export function ExecutiveBriefingDrawer({ open, onClose, objectives }: Props) {
    const briefingSections = React.useMemo(() => generateExecutiveBriefing(objectives), [objectives]);

    const handleCopy = () => {
        const text = briefingSections.map(s => {
            return `${s.title}\n${s.items.map(i => `- ${i.headline}: ${i.body}`).join('\n')}`;
        }).join('\n\n');
        navigator.clipboard.writeText(text);
        // Could show a snackbar here but keeping it simple for now
    };

    return (
        <Drawer
            anchor="bottom"
            open={open}
            onClose={onClose}
            PaperProps={{
                sx: {
                    height: '85vh',
                    borderTopLeftRadius: 16,
                    borderTopRightRadius: 16,
                    maxWidth: '800px', // Center on desktop
                    mx: 'auto'
                }
            }}
        >
            <Box height="100%" display="flex" flexDirection="column">
                {/* Header */}
                <Box p={3} display="flex" justifyContent="space-between" alignItems="center" borderBottom={1} borderColor="divider">
                    <Box display="flex" alignItems="center" gap={2}>
                        <Box bgcolor="secondary.main" color="white" p={1} borderRadius={2} display="flex">
                            <SmartToyIcon />
                        </Box>
                        <Box>
                            <Typography variant="h6" fontWeight="bold">Executive Briefing</Typography>
                            <Typography variant="caption" color="text.secondary">
                                AI-synthesized narrative for rapid consumption
                            </Typography>
                        </Box>
                    </Box>
                    <Stack direction="row" spacing={1}>
                        <Button
                            startIcon={<ContentCopyIcon />}
                            size="small"
                            onClick={handleCopy}
                            variant="outlined"
                        >
                            Copy
                        </Button>
                        <IconButton onClick={onClose} edge="end">
                            <CloseIcon />
                        </IconButton>
                    </Stack>
                </Box>

                {/* Content */}
                <Box p={3} flexGrow={1} overflow="auto" bgcolor="#f8fafc">
                    <Stack spacing={4}>
                        {briefingSections.map((section, idx) => (
                            <Box key={idx} component="section">
                                <Typography variant="h6" gutterBottom color="primary.main" fontWeight={700}>
                                    {section.title}
                                </Typography>
                                <Paper elevation={0} variant="outlined" sx={{ overflow: 'hidden' }}>
                                    {section.items.map((item, i) => (
                                        <Box key={item.id}>
                                            <Box p={2.5} bgcolor={item.severity === 'critical' ? '#fff5f5' : item.severity === 'warning' ? '#fffbeb' : 'white'}>
                                                <Typography variant="subtitle2" fontWeight={700} gutterBottom>
                                                    {item.headline}
                                                </Typography>
                                                <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
                                                    {item.body}
                                                </Typography>
                                            </Box>
                                            {i < section.items.length - 1 && <Divider />}
                                        </Box>
                                    ))}
                                </Paper>
                            </Box>
                        ))}

                        <Box pt={4} textAlign="center">
                            <Typography variant="caption" color="text.secondary">
                                Generated based on real-time heartbeat data. <br />
                                Review specific objectives in the dashboard for full evidence chain.
                            </Typography>
                        </Box>
                    </Stack>
                </Box>
            </Box>
        </Drawer>
    );
}
