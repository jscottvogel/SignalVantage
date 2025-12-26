import { useState, useEffect } from 'react';
import type { Schema } from '../../amplify/data/resource';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    Typography,
    Box,
    Chip,
    Stack,
    IconButton,
    CircularProgress,
    Paper
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';

interface Props {
    objective: Schema['StrategicObjective']['type'];
    onClose: () => void;
}

export function ObjectiveDetailModal({ objective, onClose }: Props) {
    const [outcomes, setOutcomes] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let mounted = true;
        const fetchTree = async () => {
            try {
                // Fetch outcomes, then for each outcome fetch KeyResults, then Initiatives
                const { data: outcomesRes } = await objective.outcomes();

                const outcomesWithChildren = await Promise.all(
                    outcomesRes.map(async (outcome) => {
                        const { data: krs } = await outcome.keyResults();
                        return { ...outcome, keyResults: krs }; // Initiatives logic adjusted for brevity
                    })
                );

                // Fetch all initiatives for this objective to distribute them.
                const { data: org } = await objective.organization();
                if (!org) {
                    console.error("No organization found for objective");
                    return;
                }
                const { data: allInitiatives } = await org.initiatives();

                // Map initiatives to KRs
                const outcomesFinal = outcomesWithChildren.map(outcome => ({
                    ...outcome,
                    keyResults: outcome.keyResults.map((kr: any) => ({
                        ...kr,
                        initiatives: allInitiatives.filter(init =>
                            init.linkedEntities?.keyResultIds?.includes(kr.id)
                        )
                    }))
                }));

                if (mounted) {
                    setOutcomes(outcomesFinal);
                }
            } catch (e) {
                console.error("Error fetching detail tree", e);
            } finally {
                if (mounted) setLoading(false);
            }
        };
        fetchTree();
        return () => { mounted = false; };
    }, [objective]);

    return (
        <Dialog
            open={true}
            onClose={onClose}
            maxWidth="lg"
            fullWidth
            PaperProps={{ sx: { minHeight: '80vh', bgcolor: 'background.default' } }}
        >
            <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', bgcolor: 'background.paper', borderBottom: 1, borderColor: 'divider' }}>
                <Box>
                    <Typography variant="overline" color="text.secondary" fontWeight="bold">STRATEGIC OBJECTIVE</Typography>
                    <Typography variant="h5" fontWeight="bold" color="primary.main">{objective.title}</Typography>
                </Box>
                <IconButton onClick={onClose}><CloseIcon /></IconButton>
            </DialogTitle>

            <DialogContent sx={{ p: 0 }}>
                {/* Header / Context Area */}
                <Box p={3} bgcolor="background.paper" mb={1} sx={{ borderBottom: 1, borderColor: 'divider' }}>
                    <Typography variant="body1" color="text.secondary" paragraph>
                        {objective.description || "No description provided."}
                    </Typography>
                    <Stack direction="row" spacing={1}>
                        <Chip label="On Track" color="success" size="small" />
                        <Chip label="High Confidence" variant="outlined" size="small" />
                    </Stack>
                </Box>

                {loading ? (
                    <Box display="flex" justifyContent="center" alignItems="center" height="200px">
                        <CircularProgress />
                    </Box>
                ) : (
                    <Box p={3}>
                        <Typography variant="h6" gutterBottom color="text.secondary" sx={{ textTransform: 'uppercase', fontSize: '0.875rem', fontWeight: 700, letterSpacing: 1 }}>
                            Strategy Tree
                        </Typography>

                        {outcomes.length === 0 ? (
                            <Typography color="text.secondary" fontStyle="italic">No outcomes defined.</Typography>
                        ) : (
                            <Stack spacing={3}>
                                {outcomes.map(outcome => (
                                    <Paper key={outcome.id} variant="outlined" sx={{ overflow: 'hidden' }}>
                                        <Box p={2} sx={{ backgroundColor: '#eff6ff', borderBottom: 1, borderColor: '#dbeafe' }}>
                                            <Stack direction="row" alignItems="center" spacing={1}>
                                                <Chip label="Outcome" size="small" color="primary" sx={{ borderRadius: 1, height: 20, fontSize: '0.7rem' }} />
                                                <Typography variant="subtitle1" fontWeight={600} color="text.primary">
                                                    {outcome.title}
                                                </Typography>
                                            </Stack>
                                        </Box>

                                        <Box p={2}>
                                            {outcome.keyResults.length === 0 ? (
                                                <Typography variant="body2" color="text.secondary" fontStyle="italic">No Key Results</Typography>
                                            ) : (
                                                <Stack spacing={2}>
                                                    {outcome.keyResults.map((kr: any) => (
                                                        <Box key={kr.id}>
                                                            <Stack direction="row" alignItems="flex-start" spacing={1.5}>
                                                                <Box mt={0.8} minWidth={8} height={8} borderRadius="50%" bgcolor="success.main" />
                                                                <Box flexGrow={1}>
                                                                    <Typography variant="subtitle2" color="text.primary">
                                                                        {kr.statement}
                                                                    </Typography>
                                                                    {kr.metric?.name && (
                                                                        <Typography variant="caption" display="block" color="text.secondary">
                                                                            Metric: {kr.metric.name}
                                                                        </Typography>
                                                                    )}
                                                                </Box>
                                                            </Stack>

                                                            {/* Initiatives */}
                                                            {kr.initiatives.length > 0 && (
                                                                <Box ml={3} mt={1} pl={2} borderLeft={1} borderColor="divider">
                                                                    <Stack spacing={1}>
                                                                        {kr.initiatives.map((init: any) => (
                                                                            <Paper key={init.id} elevation={0} sx={{ p: 1, bgcolor: 'grey.50', border: 1, borderColor: 'divider' }}>
                                                                                <Stack direction="row" alignItems="center" spacing={1}>
                                                                                    <Typography variant="caption" fontWeight="bold" color="secondary.main">INIT</Typography>
                                                                                    <Typography variant="body2">{init.title}</Typography>
                                                                                </Stack>
                                                                            </Paper>
                                                                        ))}
                                                                    </Stack>
                                                                </Box>
                                                            )}
                                                        </Box>
                                                    ))}
                                                </Stack>
                                            )}
                                        </Box>
                                    </Paper>
                                ))}
                            </Stack>
                        )}
                    </Box>
                )}
            </DialogContent>
        </Dialog>
    );
}
