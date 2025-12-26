import { useState, useEffect, useCallback } from 'react';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../amplify/data/resource';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Typography,
    Box,
    Chip,
    Stack,
    IconButton,
    CircularProgress,
    Paper,
    Button,
    TextField
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import AddIcon from '@mui/icons-material/Add';

const client = generateClient<Schema>();

interface Props {
    objective: Schema['StrategicObjective']['type'];
    onClose: () => void;
}

type CreateType = 'outcome' | 'kr' | 'initiative';

interface CreateDialogState {
    open: boolean;
    type: CreateType;
    parentId: string; // outcomeId or krId
    contextId?: string; // extra context if needed (e.g. outcomeId for KR)
}

export function ObjectiveDetailModal({ objective, onClose }: Props) {
    const [outcomes, setOutcomes] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    // Creation State
    const [createState, setCreateState] = useState<CreateDialogState>({ open: false, type: 'outcome', parentId: '' });
    const [newItemText, setNewItemText] = useState('');
    const [isCreating, setIsCreating] = useState(false);

    const refreshTree = useCallback(async () => {
        try {
            // Fetch outcomes
            const { data: outcomesRes } = await objective.outcomes();

            // Fetch children for each outcome
            const outcomesWithChildren = await Promise.all(
                outcomesRes.map(async (outcome) => {
                    const { data: krs } = await outcome.keyResults();
                    return { ...outcome, keyResults: krs };
                })
            );

            // Fetch all initiatives for this objective's organization to distribute them
            // Note: In a real large-scale app, we'd query by secondary index or relationship.
            // Here we filter client-side for simplicity as per previous pattern.
            const { data: org } = await objective.organization();
            if (!org) return;

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

            setOutcomes(outcomesFinal);
        } catch (e) {
            console.error("Error fetching details", e);
        } finally {
            setLoading(false);
        }
    }, [objective]);

    useEffect(() => {
        refreshTree();
    }, [refreshTree]);

    const openCreate = (type: CreateType, parentId: string = '') => {
        setCreateState({ open: true, type, parentId });
        setNewItemText('');
    };

    const handleCreateSubmit = async () => {
        if (!newItemText.trim()) return;
        setIsCreating(true);
        try {
            // Fetch Org safely:
            // Note: objective provided by props might strictly be the type, 
            // but in Gen2 fetch, it usually has the fields. If organizationId is missing, we might need to fetch it.
            // However, based on schema, StrategicObjective belongsTo Organization, so the ID should be on the record.

            // Fallback if needed, but 'objective' usually has 'organizationId' if fetched. 
            // If not, we'd need to fetch obj.organization().
            // Let's assume it's there or use the one from state if we stored it? 
            // We'll trust amplify puts the FK on the object.

            // Actually, safely:
            const { data: org } = await objective.organization();
            const SafeOrgId = org?.id;
            if (!SafeOrgId) throw new Error("Org ID missing");

            if (createState.type === 'outcome') {
                await client.models.Outcome.create({
                    organizationId: SafeOrgId,
                    strategicObjectiveId: objective.id,
                    title: newItemText,
                    status: 'active'
                });
            } else if (createState.type === 'kr') {
                await client.models.KeyResult.create({
                    organizationId: SafeOrgId,
                    strategicObjectiveId: objective.id,
                    outcomeId: createState.parentId, // parentId is outcomeId here
                    statement: newItemText,
                    status: 'active'
                });
            } else if (createState.type === 'initiative') {
                await client.models.Initiative.create({
                    organizationId: SafeOrgId,
                    title: newItemText,
                    description: '',
                    linkedEntities: {
                        strategicObjectiveIds: [objective.id],
                        keyResultIds: [createState.parentId] // parentId is krId here
                    }
                });
            }

            await refreshTree();
            setCreateState({ ...createState, open: false });
        } catch (e) {
            console.error("Creation failed", e);
            alert("Failed to create item.");
        } finally {
            setIsCreating(false);
        }
    };

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
                <IconButton onClick={onClose} aria-label="close"><CloseIcon /></IconButton>
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
                        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
                            <Typography variant="h6" color="text.secondary" sx={{ textTransform: 'uppercase', fontSize: '0.875rem', fontWeight: 700, letterSpacing: 1 }}>
                                Strategy Tree
                            </Typography>
                            <Button
                                startIcon={<AddIcon />}
                                size="small"
                                variant="outlined"
                                onClick={() => openCreate('outcome')}
                            >
                                Add Outcome
                            </Button>
                        </Box>

                        {outcomes.length === 0 ? (
                            <Paper variant="outlined" sx={{ p: 4, textAlign: 'center', borderStyle: 'dashed' }}>
                                <Typography color="text.secondary" fontStyle="italic" gutterBottom>No outcomes defined yet.</Typography>
                                <Button variant="text" onClick={() => openCreate('outcome')}>+ Add First Outcome</Button>
                            </Paper>
                        ) : (
                            <Stack spacing={3}>
                                {outcomes.map(outcome => (
                                    <Paper key={outcome.id} variant="outlined" sx={{ overflow: 'hidden' }}>
                                        <Box p={2} sx={{ backgroundColor: '#eff6ff', borderBottom: 1, borderColor: '#dbeafe', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <Stack direction="row" alignItems="center" spacing={1}>
                                                <Chip label="Outcome" size="small" color="primary" sx={{ borderRadius: 1, height: 20, fontSize: '0.7rem' }} />
                                                <Typography variant="subtitle1" fontWeight={600} color="text.primary">
                                                    {outcome.title}
                                                </Typography>
                                            </Stack>
                                            <Button
                                                size="small"
                                                startIcon={<AddIcon />}
                                                sx={{ fontSize: '0.75rem' }}
                                                onClick={() => openCreate('kr', outcome.id)}
                                            >
                                                Add KR
                                            </Button>
                                        </Box>

                                        <Box p={2}>
                                            {outcome.keyResults.length === 0 ? (
                                                <Typography variant="body2" color="text.secondary" fontStyle="italic" sx={{ py: 1 }}>No Key Results. Add one to measure success.</Typography>
                                            ) : (
                                                <Stack spacing={2}>
                                                    {outcome.keyResults.map((kr: any) => (
                                                        <Box key={kr.id}>
                                                            <Stack direction="row" alignItems="flex-start" spacing={1.5} sx={{ mb: 1 }}>
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
                                                                <Button
                                                                    size="small"
                                                                    color="secondary"
                                                                    startIcon={<AddIcon />}
                                                                    // sx={{ minWidth: 0, p: 0.5 }}
                                                                    onClick={() => openCreate('initiative', kr.id)}
                                                                >
                                                                    Link Initiative
                                                                </Button>
                                                            </Stack>

                                                            {/* Initiatives */}
                                                            {kr.initiatives.length > 0 && (
                                                                <Box ml={3} pl={2} borderLeft={1} borderColor="divider">
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

            {/* Micro-Creation Dialog */}
            <Dialog
                open={createState.open}
                onClose={() => setCreateState({ ...createState, open: false })}
                maxWidth="sm"
                fullWidth
            >
                <DialogTitle>
                    Add {createState.type === 'outcome' ? 'Outcome' : createState.type === 'kr' ? 'Key Result' : 'Initiative'}
                </DialogTitle>
                <DialogContent>
                    <TextField
                        autoFocus
                        margin="dense"
                        label={createState.type === 'outcome' ? 'Outcome Title' : createState.type === 'kr' ? 'KR Statement' : 'Initiative Title'}
                        fullWidth
                        variant="outlined"
                        value={newItemText}
                        onChange={(e) => setNewItemText(e.target.value)}
                        placeholder={
                            createState.type === 'outcome' ? "e.g. Increase User Retention" :
                                createState.type === 'kr' ? "e.g. Achieve NPS of 60" :
                                    "e.g. Launch New Mobile App"
                        }
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setCreateState({ ...createState, open: false })}>Cancel</Button>
                    <Button onClick={handleCreateSubmit} variant="contained" disabled={!newItemText.trim() || isCreating}>
                        {isCreating ? 'Adding...' : 'Add Item'}
                    </Button>
                </DialogActions>
            </Dialog>
        </Dialog>
    );
}
