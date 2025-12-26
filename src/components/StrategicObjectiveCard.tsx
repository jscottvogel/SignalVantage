import { Card, CardContent, Typography, Box, Chip, Stack } from '@mui/material';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import type { Schema } from '../../amplify/data/resource';
import { theme } from '../theme';

interface Props {
    objective: Schema['StrategicObjective']['type'];
    onClick: () => void;
}

export function StrategicObjectiveCard({ objective, onClick }: Props) {
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
                        <Chip
                            label="On Track"
                            size="small"
                            color="success"
                            sx={{
                                bgcolor: '#dcfce7',
                                color: '#166534',
                                fontWeight: 600,
                                fontSize: '0.75rem'
                            }}
                        />
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
                            <Box width={24} height={24} borderRadius="50%" bgcolor="#cbd5e1" />
                            <Typography variant="caption" color="text.primary">Unassigned</Typography>
                        </Box>
                    </Box>
                    <Box>
                        <Typography variant="caption" color="text.secondary" fontWeight="bold">PROGRESS</Typography>
                        <Stack direction="row" alignItems="center" spacing={1} mt={0.5}>
                            <Box width="60px" height="6px" borderRadius={1} bgcolor="#e2e8f0" overflow="hidden">
                                <Box width="45%" height="100%" bgcolor="primary.main" />
                            </Box>
                            <Typography variant="caption" fontWeight="bold">45%</Typography>
                        </Stack>
                    </Box>
                </Stack>
            </Box>
        </Card>
    );
}
