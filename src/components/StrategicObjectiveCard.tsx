import { useState, useEffect } from 'react';
import { Card, CardContent, Typography, Box, Chip, Stack, CircularProgress, Button, Tooltip } from '@mui/material';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import { theme } from '../theme';
import type { Schema } from '../../amplify/data/resource';

interface Props {
    objective: Schema['StrategicObjective']['type'];
    onClick: () => void;
}

import { calculateAttentionLevel } from '../utils/heartbeatLogic';

export function StrategicObjectiveCard({ objective, onClick }: Props) {
    const [krStats, setKrStats] = useState<{ stable: number; atRisk: number; total: number } | null>(null);
    const [loadingKRs, setLoadingKRs] = useState(true);

    const latestHeartbeat = objective.latestHeartbeat;
    const systemAssessment = latestHeartbeat?.systemAssessment;
    const ownerInput = latestHeartbeat?.ownerInput;

    // derived signals
    const rawConf = systemAssessment?.systemConfidence || ownerInput?.ownerConfidence;
    const confidence = typeof rawConf === 'number' ? rawConf : (rawConf === 'HIGH' ? 90 : rawConf === 'MEDIUM' ? 70 : rawConf === 'LOW' ? 30 : 50);
    const trend = systemAssessment?.confidenceTrend || 'STABLE';

    // Calculate Attention Level
    const attentionLevel = calculateAttentionLevel(objective);

    const isStable = attentionLevel === 'STABLE';

    // Fetch KRs for Stats
    useEffect(() => {
        let mounted = true;
        async function fetchKRs() {
            try {
                const { data: krs } = await objective.keyResults();
                if (!mounted) return;

                let stable = 0;
                let atRisk = 0;

                krs.forEach(kr => {
                    const resultConf = kr.latestHeartbeat?.systemAssessment?.systemConfidence ||
                        kr.latestHeartbeat?.ownerInput?.ownerConfidence || 'MEDIUM';
                    const resultTrend = kr.latestHeartbeat?.systemAssessment?.confidenceTrend;

                    if (resultConf === 'LOW' || resultTrend === 'DECLINING') atRisk++;
                    else stable++;
                });

                setKrStats({ stable, atRisk, total: krs.length });
            } catch (e) {
                console.error("Failed to fetch KRs", e);
            } finally {
                if (mounted) setLoadingKRs(false);
            }
        }
        fetchKRs();
        return () => { mounted = false; };
    }, [objective]);

    const TrendArrow = ({ t }: { t: string }) => {
        if (t === 'IMPROVING') return <Typography component="span" fontWeight="bold" color="success.main">↑</Typography>;
        if (t === 'DECLINING') return <Typography component="span" fontWeight="bold" color="error.main">↓</Typography>;
        return <Typography component="span" fontWeight="bold" color="text.secondary">→</Typography>;
    };

    const AttentionSignal = () => {
        if (attentionLevel === 'ACTION') return <Chip label="Action Needed" color="error" size="small" icon={<ErrorOutlineIcon />} sx={{ fontWeight: 'bold' }} />;
        if (attentionLevel === 'WATCH') return <Chip label="Watch" color="warning" size="small" icon={<WarningAmberIcon />} sx={{ fontWeight: 'bold' }} />;
        return <Chip label="Stable" color="success" size="small" icon={<CheckCircleOutlineIcon />} variant="outlined" sx={{ opacity: 0.8 }} />;
    };

    // Extract Risks
    const risks = [
        ...(systemAssessment?.uncertaintyFlags || []),
        ...(ownerInput?.newRisks?.map(r => r?.description).filter(Boolean) || [])
    ].slice(0, 3); // Top 3

    return (
        <Card
            elevation={isStable ? 0 : 2}
            sx={{
                height: '100%',
                display: 'flex',
                cursor: 'default', // Card itself isn't the click target for whole drilldown to avoid accidents? Spec says "View details" action.
                flexDirection: 'column',
                border: isStable ? '1px solid #e2e8f0' : '1px solid #cbd5e1',
                bgcolor: isStable ? '#f8fafc' : '#ffffff', // Muted background for stable
                opacity: isStable ? 0.85 : 1,
                transition: 'all 0.2s',
                '&:hover': {
                    opacity: 1,
                    borderColor: theme.palette.primary.main,
                    transform: 'translateY(-2px)',
                    boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'
                }
            }}
        >
            <CardContent sx={{ p: 2.5, display: 'flex', flexDirection: 'column', gap: 2, flexGrow: 1 }}>

                {/* Header: Attention & Title */}
                <Box>
                    <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                        <AttentionSignal />
                        <Button size="small" onClick={onClick} endIcon={<ChevronRightIcon />}>
                            View Details
                        </Button>
                    </Box>
                    <Typography variant="h6" lineHeight={1.2} fontWeight={700} color="text.primary">
                        {objective.title}
                    </Typography>
                </Box>

                {/* 1. Confidence & Trend */}
                <Box display="flex" alignItems="center" gap={1}>
                    <Typography variant="caption" color="text.secondary" fontWeight="bold" textTransform="uppercase">Confidence</Typography>
                    <Chip
                        label={`${confidence}%`}
                        size="small"
                        color={confidence >= 80 ? 'success' : confidence >= 50 ? 'warning' : 'error'}
                        variant={confidence >= 80 ? 'outlined' : 'filled'}
                    />
                    <Box display="flex" alignItems="center" bgcolor="grey.100" px={1} py={0.5} borderRadius={1} gap={0.5}>
                        <Typography variant="caption" fontWeight="bold" color="text.secondary">TREND</Typography>
                        <TrendArrow t={trend} />
                    </Box>
                </Box>

                {/* 2. Risk & Uncertainty */}
                {risks.length > 0 ? (
                    <Box bgcolor={attentionLevel === 'ACTION' ? '#fef2f2' : '#fffbeb'} p={1.5} borderRadius={1} border={1} borderColor={attentionLevel === 'ACTION' ? '#fecaca' : '#fde68a'}>
                        <Typography variant="caption" fontWeight="bold" color={attentionLevel === 'ACTION' ? 'error.main' : 'warning.dark'} display="flex" alignItems="center" gap={0.5}>
                            {attentionLevel === 'ACTION' ? <ErrorOutlineIcon fontSize="inherit" /> : <WarningAmberIcon fontSize="inherit" />}
                            Risk Drivers
                        </Typography>
                        <Stack spacing={0.5} mt={0.5}>
                            {risks.map((r, i) => (
                                <Typography key={i} variant="caption" display="block" color="text.primary" sx={{ lineHeight: 1.3 }}>
                                    • {r}
                                </Typography>
                            ))}
                        </Stack>
                    </Box>
                ) : (
                    <Box minHeight={20} /> // Spacer if no risks, or collapse?
                )}

                {/* 3. Change Since Last Update */}
                <Box>
                    <Typography variant="caption" color="text.secondary" fontWeight="bold" textTransform="uppercase" display="block" mb={0.5}>
                        Recent Update
                    </Typography>
                    <Typography variant="body2" color="text.primary" sx={{
                        display: '-webkit-box',
                        WebkitLineClamp: 3,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                        fontStyle: !latestHeartbeat?.summary ? 'italic' : 'normal',
                        color: !latestHeartbeat?.summary ? 'text.secondary' : 'text.primary'
                    }}>
                        {latestHeartbeat?.summary || "No material change since last review."}
                    </Typography>
                </Box>

                <Box flexGrow={1} />

                {/* 4. Stats Footer */}
                <Box pt={2} borderTop={1} borderColor="divider" display="flex" justifyContent="space-between" alignItems="center">
                    <Typography variant="caption" color="text.secondary">Key Results</Typography>
                    {loadingKRs ? (
                        <CircularProgress size={16} />
                    ) : (
                        <Stack direction="row" spacing={1}>
                            <Tooltip title="Stable Key Results">
                                <Chip label={`${krStats?.stable || 0} Stable`} size="small" variant="outlined" color="default" sx={{ height: 20, fontSize: '0.65rem' }} />
                            </Tooltip>
                            {(krStats?.atRisk || 0) > 0 && (
                                <Tooltip title="At Risk Key Results">
                                    <Chip label={`${krStats?.atRisk} At Risk`} size="small" color="error" sx={{ height: 20, fontSize: '0.65rem', fontWeight: 'bold' }} />
                                </Tooltip>
                            )}
                        </Stack>
                    )}
                </Box>

            </CardContent>
        </Card>
    );
}
