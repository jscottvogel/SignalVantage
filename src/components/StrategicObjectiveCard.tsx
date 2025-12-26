import { useState, useEffect } from 'react';
import type { Schema } from '../../amplify/data/resource';
import {
    Card,
    CardContent,
    Typography,
    Box,
    Chip,
    Stack,
    Skeleton
} from '@mui/material';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';

interface Props {
    objective: Schema['StrategicObjective']['type'];
    onClick: () => void;
}

export function StrategicObjectiveCard({ objective, onClick }: Props) {
    const [outcomeCount, setOutcomeCount] = useState<number | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let mounted = true;
        const fetchDetails = async () => {
            try {
                // Fetch outcomes to get count
                const { data: outcomes } = await objective.outcomes();
                if (mounted) {
                    setOutcomeCount(outcomes.length);
                }
            } catch (e) {
                console.error("Error fetching objective details", e);
            } finally {
                if (mounted) setLoading(false);
            }
        };

        fetchDetails();
        return () => { mounted = false; };
    }, [objective]);

    return (
        <Card
            onClick={onClick}
            sx={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                cursor: 'pointer',
                '&:hover': {
                    borderColor: 'primary.main',
                    transform: 'translateY(-2px)',
                    boxShadow: 4
                }
            }}
        >
            <CardContent sx={{ flexGrow: 1 }}>
                <Typography variant="h6" component="div" gutterBottom sx={{ fontWeight: 600 }}>
                    {objective.title}
                </Typography>

                <Typography variant="body2" color="text.secondary" sx={{
                    mb: 2,
                    display: '-webkit-box',
                    overflow: 'hidden',
                    WebkitBoxOrient: 'vertical',
                    WebkitLineClamp: 3,
                }}>
                    {objective.description || "No description provided."}
                </Typography>

                <Stack direction="row" spacing={1} mt={2}>
                    {/* Placeholder status chips - logic to be added later */}
                    <Chip label="On Track" color="success" size="small" variant="filled" />
                </Stack>
            </CardContent>

            <Box sx={{
                p: 2,
                pt: 1,
                borderTop: '1px solid',
                borderColor: 'divider',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                bgcolor: 'grey.50'
            }}>
                <Typography variant="caption" color="text.secondary" fontWeight={500}>
                    {loading ? <Skeleton width={60} /> : `${outcomeCount} Outcomes`}
                </Typography>
                <ChevronRightIcon color="action" fontSize="small" />
            </Box>
        </Card>
    );
}
