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
    TextField,
    Select,
    MenuItem,
    FormControl,
    InputLabel,
    Tooltip
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import AddIcon from '@mui/icons-material/Add';
import PersonIcon from '@mui/icons-material/Person';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';

const client = generateClient<Schema>();

interface Props {
    objective: Schema['StrategicObjective']['type'];
    onClose: () => void;
}

type ItemType = 'outcome' | 'kr' | 'initiative';

interface ItemDialogState {
    open: boolean;
    mode: 'create' | 'edit';
    type: ItemType;
    parentId?: string; // For create
    id?: string; // For edit
    initialText?: string;
    initialOwner?: string;
}

export function ObjectiveDetailModal({ objective, onClose }: Props) {
    const [outcomes, setOutcomes] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [members, setMembers] = useState<any[]>([]);

    // Dialog State
    const [dialogState, setDialogState] = useState<ItemDialogState>({
        open: false,
        mode: 'create',
        type: 'outcome'
    });
    const [itemText, setItemText] = useState('');
    const [selectedOwnerId, setSelectedOwnerId] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

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

            // Fetch organization & members
            const { data: org } = await objective.organization();
            if (!org) return;

            // Fetch Members for picker
            const { data: membershipList } = await org.members();
            const membersWithProfiles = await Promise.all(
                membershipList.map(async (m) => {
                    const { data: profile } = await m.user();
                    return { ...m, profile };
                })
            );
            setMembers(membersWithProfiles);

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

    const openDialog = (
        mode: 'create' | 'edit',
        type: ItemType,
        parentId: string = '',
        item?: any
    ) => {
        let initText = '';
        let initOwner = '';

        if (mode === 'edit' && item) {
            initText = item.title || item.statement || '';
            // Handle owner: item.owner (single) or item.owners[0] (array)
            const owner = item.owner || (item.owners && item.owners[0]);
            initOwner = owner?.userId || '';
        }

        setDialogState({
            open: true,
            mode,
            type,
            parentId,
            id: item?.id
        });
        setItemText(initText);
        setSelectedOwnerId(initOwner);
    };

    const handleDelete = async (type: ItemType, id: string) => {
        if (!window.confirm("Are you sure you want to delete this item?")) return;
        try {
            if (type === 'outcome') {
                await client.models.Outcome.delete({ id });
            } else if (type === 'kr') {
                await client.models.KeyResult.delete({ id });
            } else if (type === 'initiative') {
                await client.models.Initiative.delete({ id });
            }
            await refreshTree();
        } catch (e) {
            console.error("Delete failed", e);
            alert("Failed to delete item.");
        }
    };

    const handleSubmit = async () => {
        if (!itemText.trim()) return;
        setIsSubmitting(true);
        try {
            const { data: org } = await objective.organization();
            const SafeOrgId = org?.id;
            if (!SafeOrgId) throw new Error("Org ID missing");

            let ownerObj = null;
            if (selectedOwnerId) {
                const member = members.find(m => m.userProfileId === selectedOwnerId);
                if (member) {
                    ownerObj = {
                        userId: member.userProfileId,
                        displayName: member.profile?.preferredName || 'Unknown',
                        role: member.role
                    };
                }
            }

            if (dialogState.mode === 'create') {
                if (dialogState.type === 'outcome') {
                    await client.models.Outcome.create({
                        organizationId: SafeOrgId,
                        strategicObjectiveId: objective.id,
                        title: itemText,
                        status: 'active',
                        owner: ownerObj
                    });
                } else if (dialogState.type === 'kr') {
                    await client.models.KeyResult.create({
                        organizationId: SafeOrgId,
                        strategicObjectiveId: objective.id,
                        outcomeId: dialogState.parentId!,
                        statement: itemText,
                        status: 'active',
                        owners: ownerObj ? [ownerObj] : []
                    });
                } else if (dialogState.type === 'initiative') {
                    await client.models.Initiative.create({
                        organizationId: SafeOrgId,
                        title: itemText,
                        description: '',
                        owner: ownerObj,
                        linkedEntities: {
                            strategicObjectiveIds: [objective.id],
                            keyResultIds: [dialogState.parentId!]
                        }
                    });
                }
            } else {
                // UPDATE MODE
                const id = dialogState.id!;
                if (dialogState.type === 'outcome') {
                    await client.models.Outcome.update({
                        id,
                        title: itemText,
                        owner: ownerObj
                    });
                } else if (dialogState.type === 'kr') {
                    await client.models.KeyResult.update({
                        id,
                        statement: itemText,
                        owners: ownerObj ? [ownerObj] : []
                    });
                } else if (dialogState.type === 'initiative') {
                    await client.models.Initiative.update({
                        id,
                        title: itemText,
                        owner: ownerObj
                    });
                }
            }

            await refreshTree();
            setDialogState({ ...dialogState, open: false });
        } catch (e) {
            console.error("Operation failed", e);
            alert("Failed to save item.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const OwnerChip = ({ owner }: { owner: any }) => {
        if (!owner) return null;
        const name = owner.displayName || 'Unassigned';
        return (
            <Chip
                icon={<PersonIcon />}
                label={name}
                size="small"
                variant="outlined"
                sx={{ height: 24, '.MuiChip-icon': { fontSize: 16 } }}
            />
        );
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
                    <Stack direction="row" spacing={2} alignItems="center">
                        <Typography variant="h5" fontWeight="bold" color="primary.main">{objective.title}</Typography>
                        {objective.owner && <OwnerChip owner={objective.owner} />}
                    </Stack>
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
                                onClick={() => openDialog('create', 'outcome')}
                            >
                                Add Outcome
                            </Button>
                        </Box>

                        {outcomes.length === 0 ? (
                            <Paper variant="outlined" sx={{ p: 4, textAlign: 'center', borderStyle: 'dashed' }}>
                                <Typography color="text.secondary" fontStyle="italic" gutterBottom>No outcomes defined yet.</Typography>
                                <Button variant="text" onClick={() => openDialog('create', 'outcome')}>+ Add First Outcome</Button>
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
                                                <OwnerChip owner={outcome.owner} />
                                            </Stack>
                                            <Stack direction="row" spacing={1}>
                                                <Tooltip title="Edit Outcome"><IconButton size="small" onClick={() => openDialog('edit', 'outcome', '', outcome)}><EditIcon fontSize="small" /></IconButton></Tooltip>
                                                <Tooltip title="Delete Outcome"><IconButton size="small" onClick={() => handleDelete('outcome', outcome.id)}><DeleteIcon fontSize="small" /></IconButton></Tooltip>
                                                <Button
                                                    size="small"
                                                    startIcon={<AddIcon />}
                                                    sx={{ fontSize: '0.75rem', ml: 1 }}
                                                    onClick={() => openDialog('create', 'kr', outcome.id)}
                                                >
                                                    Add KR
                                                </Button>
                                            </Stack>
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
                                                                    <Stack direction="row" spacing={1} alignItems="center">
                                                                        <Typography variant="subtitle2" color="text.primary">
                                                                            {kr.statement}
                                                                        </Typography>
                                                                        {kr.owners && kr.owners.length > 0 && <OwnerChip owner={kr.owners[0]} />}
                                                                        <Tooltip title="Edit KR"><IconButton size="small" sx={{ p: 0.5 }} onClick={() => openDialog('edit', 'kr', '', kr)}><EditIcon sx={{ fontSize: 14 }} /></IconButton></Tooltip>
                                                                        <Tooltip title="Delete KR"><IconButton size="small" sx={{ p: 0.5 }} onClick={() => handleDelete('kr', kr.id)}><DeleteIcon sx={{ fontSize: 14 }} /></IconButton></Tooltip>
                                                                    </Stack>
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
                                                                    onClick={() => openDialog('create', 'initiative', kr.id)}
                                                                >
                                                                    Link Init
                                                                </Button>
                                                            </Stack>

                                                            {/* Initiatives */}
                                                            {kr.initiatives && kr.initiatives.length > 0 && (
                                                                <Box ml={3} pl={2} borderLeft={1} borderColor="divider">
                                                                    <Stack spacing={1}>
                                                                        {kr.initiatives.map((init: any) => (
                                                                            <Paper key={init.id} elevation={0} sx={{ p: 1, bgcolor: 'grey.50', border: 1, borderColor: 'divider' }}>
                                                                                <Stack direction="row" alignItems="center" spacing={1}>
                                                                                    <Typography variant="caption" fontWeight="bold" color="secondary.main">INIT</Typography>
                                                                                    <Typography variant="body2">{init.title}</Typography>
                                                                                    <OwnerChip owner={init.owner} />
                                                                                    <Box flexGrow={1} />
                                                                                    <Tooltip title="Edit Initiative"><IconButton size="small" sx={{ p: 0.5 }} onClick={() => openDialog('edit', 'initiative', '', init)}><EditIcon sx={{ fontSize: 14 }} /></IconButton></Tooltip>
                                                                                    <Tooltip title="Delete Initiative"><IconButton size="small" sx={{ p: 0.5 }} onClick={() => handleDelete('initiative', init.id)}><DeleteIcon sx={{ fontSize: 14 }} /></IconButton></Tooltip>
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

            {/* Item Dialog (Create/Edit) */}
            <Dialog
                open={dialogState.open}
                onClose={() => setDialogState({ ...dialogState, open: false })}
                maxWidth="sm"
                fullWidth
            >
                <DialogTitle>
                    {dialogState.mode === 'create' ? 'Add' : 'Edit'} {dialogState.type === 'outcome' ? 'Outcome' : dialogState.type === 'kr' ? 'Key Result' : 'Initiative'}
                </DialogTitle>
                <DialogContent>
                    <Box display="flex" flexDirection="column" gap={2} pt={1}>
                        <TextField
                            autoFocus
                            label={dialogState.type === 'outcome' ? 'Outcome Title' : dialogState.type === 'kr' ? 'KR Statement' : 'Initiative Title'}
                            fullWidth
                            variant="outlined"
                            value={itemText}
                            onChange={(e) => setItemText(e.target.value)}
                            placeholder={
                                dialogState.type === 'outcome' ? "e.g. Increase User Retention" :
                                    dialogState.type === 'kr' ? "e.g. Achieve NPS of 60" :
                                        "e.g. Launch New Mobile App"
                            }
                        />
                        <FormControl fullWidth>
                            <InputLabel id="owner-select-label">Owner (Optional)</InputLabel>
                            <Select
                                labelId="owner-select-label"
                                value={selectedOwnerId}
                                label="Owner (Optional)"
                                onChange={(e) => setSelectedOwnerId(e.target.value)}
                            >
                                <MenuItem value=""><em>None</em></MenuItem>
                                {members.map((m) => (
                                    <MenuItem key={m.userProfileId} value={m.userProfileId}>
                                        {m.profile?.preferredName || m.profile?.email || 'Unknown'}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDialogState({ ...dialogState, open: false })}>Cancel</Button>
                    <Button onClick={handleSubmit} variant="contained" disabled={!itemText.trim() || isSubmitting}>
                        {isSubmitting ? 'Saving...' : 'Save'}
                    </Button>
                </DialogActions>
            </Dialog>
        </Dialog>
    );
}
