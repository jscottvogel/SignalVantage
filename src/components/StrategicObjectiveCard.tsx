import { Card, CardContent, Typography, Box, Chip, Stack } from '@mui/material';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import type { Schema } from '../../amplify/data/resource';
import { theme } from '../theme';

interface Props {
    objective: Schema['StrategicObjective']['type'];
    onClick: () => void;
}

export function StrategicObjectiveCard({ objective, onClick }: Props) {
    const HeartbeatStatus = ({ due }: { due?: string | null }) => {
        if (!due) return null;
        const isLate = new Date(due) < new Date();
        return (
            <Chip
                label={isLate ? "Heartbeat Late" : `Due: ${new Date(due).toLocaleDateString()}`}
                size="small"
                color={isLate ? "error" : "default"}
                variant={isLate ? "filled" : "outlined"}
                sx={{ fontSize: '0.7rem', height: 20 }}
            />
        );
    };

    const ownerName = objective.owner?.displayName || 'Unassigned';

    return (
        <Card
            onClick={onClick}
            sx={{
                cursor: 'pointer',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                transition: 'all 0.2s ease-in-out',
                '&:hover': {
                    transform: 'translateY(-2px)',
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
                    borderColor: theme.palette.primary.main, // Focus border on hover
                }
            }}
        >
            <CardContent sx={{ flexGrow: 1, p: 3 }}>
                <Stack spacing={2}>
                    <Box display="flex" justifyContent="space-between" alignItems="flex-start">
                        <Stack direction="row" spacing={1}>
                            {objective.latestHeartbeat?.ownerInput?.ownerConfidence ? (
                                <Chip
                                    label={objective.latestHeartbeat.ownerInput.ownerConfidence}
                                    size="small"
                                    color={['HIGH', 'active'].includes(objective.latestHeartbeat.ownerInput.ownerConfidence) ? 'success' : 'default'} // Simplified color mapping
                                    sx={{ fontWeight: 600, fontSize: '0.75rem' }}
                                />
                            ) : (
                                <Chip label="Active" size="small" variant="outlined" />
                            )}
                            <HeartbeatStatus due={objective.nextHeartbeatDue} />
                        </Stack>
                        <ChevronRightIcon color="action" />
                    </Box>

                    <Box>
                        <Typography variant="h5" component="div" gutterBottom fontWeight="bold" color="text.primary">
                            {objective.title}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{
                            display: '-webkit-box',
                            WebkitLineClamp: 3,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                            height: '4.5em' // Fixed height for alignment
                        }}>
                            {objective.description || "No description provided."}
                        </Typography>
                    </Box>
                </Stack>
            </CardContent>

            <Box sx={{ px: 3, pb: 2, pt: 0 }}>
                <Stack direction="row" spacing={3} alignItems="center">
                    <Box>
                        <Typography variant="caption" color="text.secondary" fontWeight="bold">OWNER</Typography>
                        <Box display="flex" alignItems="center" gap={1} mt={0.5}>
                            <Box width={24} height={24} borderRadius="50%" bgcolor="#cbd5e1" display="flex" alignItems="center" justifyContent="center">
                                <Typography variant="caption" color="text.secondary">{ownerName[0]}</Typography>
                            </Box>
                            <Typography variant="caption" color="text.primary">{ownerName}</Typography>
                        </Box>
                    </Box>
                </Stack>
            </Box>
        </Card>
    );
}
