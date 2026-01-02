
import { Card, CardContent, Typography, Box, CircularProgress } from '@mui/material';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import { theme } from '../theme';
import type { Schema } from '../../amplify/data/resource';

interface Props {
    objective: Schema['StrategicObjective']['type'];
    onClick: () => void;
}

import { calculateAttentionLevel } from '../utils/heartbeatLogic';

export function StrategicObjectiveCard({ objective, onClick }: Props) {
    const latestHeartbeat = objective.latestHeartbeat;
    const systemAssessment = latestHeartbeat?.systemAssessment;
    const ownerInput = latestHeartbeat?.ownerInput;

    const getConfidenceValue = (val: number | string | null | undefined): number => {
        if (typeof val === 'number') return val;
        if (val === 'HIGH') return 90;
        if (val === 'MEDIUM') return 70;
        if (val === 'LOW') return 30;
        return 50;
    };

    const rawConf = systemAssessment?.systemConfidence ?? ownerInput?.ownerConfidence;
    const confidence = getConfidenceValue(rawConf);
    const trend = systemAssessment?.confidenceTrend || 'STABLE';

    // Calculate Attention Level
    const attentionLevel = calculateAttentionLevel(objective);

    const getStatusColor = () => {
        switch (attentionLevel) {
            case 'ACTION': return theme.palette.error.main;
            case 'WATCH': return theme.palette.warning.main;
            default: return theme.palette.success.main;
        }
    };

    const statusColor = getStatusColor();

    // Extract Risks
    const risks = [
        ...(systemAssessment?.uncertaintyFlags || []),
        ...(ownerInput?.newRisks?.map(r => r?.description).filter((d): d is string => !!d) || [])
    ].slice(0, 3);


    return (
        <Card
            elevation={2}
            onClick={onClick}
            sx={{
                height: '100%',
                display: 'flex',
                cursor: 'pointer',
                flexDirection: 'column',
                borderLeft: `6px solid ${statusColor}`,
                transition: 'all 0.2s',
                '&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow: 4
                }
            }}
        >
            <CardContent sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 2, flexGrow: 1 }}>

                {/* Header: Title & Trend */}
                <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                    <Typography variant="h6" lineHeight={1.2} fontWeight={700} color="text.primary">
                        {objective.title}
                    </Typography>
                    {trend === 'IMPROVING' && <Typography color="success.main" variant="h6" fontWeight="bold" sx={{ fontSize: '2.5rem' }}>↗</Typography>}
                    {trend === 'DECLINING' && <Typography color="error.main" variant="h6" fontWeight="bold" sx={{ fontSize: '2.5rem' }}>↘</Typography>}
                </Box>

                {/* Confidence Circular Indicator */}
                <Box display="flex" alignItems="center" gap={2}>
                    <Box position="relative" display="inline-flex">
                        <CircularProgress
                            variant="determinate"
                            value={confidence}
                            color={confidence >= 80 ? 'success' : confidence >= 50 ? 'warning' : 'error'}
                            size={56}
                            thickness={5}
                            sx={{
                                color: confidence >= 80 ? theme.palette.success.main : confidence >= 50 ? theme.palette.warning.main : theme.palette.error.main,
                                opacity: 0.9
                            }}
                        />
                        <Box
                            sx={{
                                top: 0,
                                left: 0,
                                bottom: 0,
                                right: 0,
                                position: 'absolute',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                            }}
                        >
                            <Typography variant="caption" component="div" color="text.secondary" fontWeight="bold">
                                {confidence}%
                            </Typography>
                        </Box>
                    </Box>
                    <Box>
                        <Typography variant="caption" color="text.secondary" fontWeight="bold" letterSpacing={1}>CONFIDENCE</Typography>
                        <Typography variant="body2" color="text.primary" fontWeight={600}>
                            {confidence >= 80 ? "High Confidence" : confidence >= 50 ? "Medium Confidence" : "Low Confidence"}
                        </Typography>
                    </Box>
                </Box>

                {/* Recent Update */}
                <Box bgcolor="grey.50" p={2} borderRadius={2} border={1} borderColor="grey.100">
                    <Typography variant="caption" color="text.secondary" fontWeight="bold" textTransform="uppercase" display="block" mb={0.5}>
                        Latest Update
                    </Typography>
                    <Typography variant="body2" color="text.primary" sx={{
                        display: '-webkit-box',
                        WebkitLineClamp: 3,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                        fontStyle: !latestHeartbeat?.summary ? 'italic' : 'normal',
                        opacity: !latestHeartbeat?.summary ? 0.7 : 1
                    }}>
                        {latestHeartbeat?.summary || "No material change since last review."}
                    </Typography>
                </Box>

                <Box flexGrow={1} />

                {/* Risk Footer - Minimal */}
                {risks.length > 0 && (
                    <Box display="flex" alignItems="center" gap={1} color={attentionLevel === 'ACTION' ? 'error.main' : 'warning.dark'}>
                        {attentionLevel === 'ACTION' ? <ErrorOutlineIcon fontSize="small" /> : <WarningAmberIcon fontSize="small" />}
                        <Typography variant="caption" fontWeight="bold">
                            {risks.length} Risk Drivers Identified
                        </Typography>
                    </Box>
                )}

            </CardContent>
        </Card>
    );
}
