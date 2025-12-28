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
import MonitorHeartIcon from '@mui/icons-material/MonitorHeart';
import HistoryIcon from '@mui/icons-material/History';
import HistoryIcon from '@mui/icons-material/History';
import BalanceIcon from '@mui/icons-material/Balance';
import HeartbeatWizard from './HeartbeatWizard';
import HeartbeatHistoryDialog from './HeartbeatHistoryDialog';
import WeightDistributionModal from './WeightDistributionModal';

const client = generateClient<Schema>();

interface Props {
    objective: Schema['StrategicObjective']['type'];
    onClose: () => void;
}

type ItemType = 'outcome' | 'kr' | 'initiative' | 'objective';

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
    const [itemDescription, setItemDescription] = useState('');
    const [itemStatus, setItemStatus] = useState('active'); // Default status
    const [itemMetricName, setItemMetricName] = useState('');
    const [selectedOwnerId, setSelectedOwnerId] = useState('');

    // Cadence State
    const [itemCadenceFreq, setItemCadenceFreq] = useState('');
    const [itemCadenceDay, setItemCadenceDay] = useState('FRI');
    const [itemCadenceHour, setItemCadenceHour] = useState(9); // 9 AM default

    const [isSubmitting, setIsSubmitting] = useState(false);

    // Heartbeat Wizard State
    const [heartbeatState, setHeartbeatState] = useState<{ open: boolean, item: any | null, type: 'initiative' | 'outcome' | 'objective' | 'kr' }>({
        open: false,
        item: null,
        type: 'initiative'
    });

    const [historyState, setHistoryState] = useState<{ open: boolean, item: any | null, type: 'initiative' | 'outcome' | 'objective' | 'kr' }>({
        open: false,
        item: null,
        type: 'initiative'
    });

    const [weightModalState, setWeightModalState] = useState<{
        open: boolean;
        items: any[];
        parentTitle: string;
        childType: 'Outcome' | 'Key Result' | 'Initiative';
        onSave: (updates: { id: string, weight: number }[]) => Promise<void>;
    }>({
        open: false,
        items: [],
        parentTitle: '',
        childType: 'Outcome',
        onSave: async () => { }
    });

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

            // Fetch initiatives directly to ensure we get them all
            const { data: allInitiatives } = await client.models.Initiative.list({
                filter: { organizationId: { eq: org.id } },
                limit: 1000 // Ensure we get enough
            });
            console.log("Debug: All Initiatives Fetched:", allInitiatives);

            // Map initiatives to KRs
            const outcomesFinal = outcomesWithChildren.map(outcome => ({
                ...outcome,
                keyResults: outcome.keyResults.map((kr: any) => {
                    const linked = allInitiatives.filter(init => {
                        const ids = init.linkedEntities?.keyResultIds || [];
                        return ids.includes(kr.id);
                    });
                    console.log(`Debug: KR ${kr.id} linked initiatives:`, linked);
                    return {
                        ...kr,
                        initiatives: linked
                    };
                })
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
        let initDesc = '';
        let initStatus = 'active';
        let initMetric = '';
        let initFreq = '';
        let initDay = 'FRI';
        let initHour = 9;

        if (mode === 'edit' && item) {
            initText = item.title || item.statement || '';
            // Handle owner: item.owner (single) or item.owners[0] (array)
            const owner = item.owner || (item.owners && item.owners[0]);
            initOwner = owner?.userId || '';
            initDesc = item.description || '';

            if (type === 'initiative') {
                initStatus = item.state?.lifecycle || 'planned';
            } else {
                initStatus = item.status || 'active';
            }

            if (type === 'kr') {
                initMetric = item.metric?.name || '';
            }

            if (item.heartbeatCadence) {
                initFreq = item.heartbeatCadence.frequency || '';
                initDay = item.heartbeatCadence.dayOfWeek || 'FRI';
                initHour = item.heartbeatCadence.hour ?? 9;
            }
        } else {
            // Defaults for create
            if (type === 'initiative') initStatus = 'planned';
            else initStatus = 'active';
        }

        setDialogState({
            open: true,
            mode,
            type,
            parentId,
            id: item?.id
        });
        setItemText(initText);
        setItemDescription(initDesc);
        setItemStatus(initStatus);
        setItemMetricName(initMetric);
        setSelectedOwnerId(initOwner);
        setItemCadenceFreq(initFreq);
        setItemCadenceDay(initDay);
        setItemCadenceHour(initHour);
    };

    const openHeartbeatWizard = (type: 'initiative' | 'outcome' | 'objective' | 'kr', item: any) => {
        setHeartbeatState({ open: true, item, type });
    };

    const handleDelete = async (type: ItemType, id: string) => {
        if (!window.confirm("Are you sure you want to delete this item?")) return;
        try {
            if (type === 'objective') {
                await client.models.StrategicObjective.delete({ id });
                onClose(); // Close modal after deleting the main object
                // Ideally trigger refresh on parent, but page reload or polling works for now
                window.location.reload();
            } else if (type === 'outcome') {
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

            const cadenceObj = itemCadenceFreq ? {
                frequency: itemCadenceFreq as any,
                dayOfWeek: (itemCadenceFreq !== 'DAILY' ? itemCadenceDay : null) as any,
                hour: itemCadenceHour
            } : null;

            let nextDue = null;
            if (cadenceObj) {
                const date = new Date();
                date.setHours(cadenceObj.hour || 9, 0, 0, 0);
                if (cadenceObj.frequency === 'DAILY') date.setDate(date.getDate() + 1);
                else if (cadenceObj.frequency === 'WEEKLY') date.setDate(date.getDate() + 7);
                else if (cadenceObj.frequency === 'BIWEEKLY') date.setDate(date.getDate() + 14);
                else if (cadenceObj.frequency === 'MONTHLY') date.setMonth(date.getMonth() + 1);
                nextDue = date.toISOString();
            }

            if (dialogState.mode === 'create') {
                if (dialogState.type === 'outcome') {
                    // Balancing Logic for Outcome
                    const siblings = outcomes; // Already loaded
                    const newCount = siblings.length + 1;
                    const newWeight = Math.floor(100 / newCount);

                    // Update siblings
                    await Promise.all(siblings.map(s =>
                        client.models.Outcome.update({ id: s.id, weight: newWeight })
                    ));

                    await client.models.Outcome.create({
                        organizationId: SafeOrgId,
                        strategicObjectiveId: objective.id,
                        title: itemText,
                        description: itemDescription,
                        status: itemStatus as any,
                        owner: ownerObj,
                        heartbeatCadence: cadenceObj || undefined,
                        nextHeartbeatDue: nextDue || undefined,
                        weight: newWeight
                    });
                } else if (dialogState.type === 'kr') {
                    // Balancing Logic for KR
                    const parentOutcome = outcomes.find(o => o.id === dialogState.parentId);
                    const siblings = parentOutcome?.keyResults || [];
                    const newCount = siblings.length + 1;
                    const newWeight = Math.floor(100 / newCount);

                    await Promise.all(siblings.map((s: any) =>
                        client.models.KeyResult.update({ id: s.id, weight: newWeight })
                    ));

                    await client.models.KeyResult.create({
                        organizationId: SafeOrgId,
                        strategicObjectiveId: objective.id,
                        outcomeId: dialogState.parentId!,
                        statement: itemText,
                        status: itemStatus as any,
                        owners: ownerObj ? [ownerObj] : [],
                        metric: itemMetricName ? { name: itemMetricName } : null,
                        heartbeatCadence: cadenceObj || undefined,
                        nextHeartbeatDue: nextDue || undefined,
                        weight: newWeight
                    });
                } else if (dialogState.type === 'initiative') {
                    // Balancing Logic for Initiative
                    // Need to find siblings.
                    // Flatten KRs to find parent KR
                    let siblings: any[] = [];
                    for (const o of outcomes) {
                        for (const k of o.keyResults) {
                            if (k.id === dialogState.parentId) {
                                siblings = k.initiatives || [];
                                break;
                            }
                        }
                    }

                    const newCount = siblings.length + 1;
                    const newWeight = Math.floor(100 / newCount);

                    await Promise.all(siblings.map((s: any) =>
                        client.models.Initiative.update({ id: s.id, weight: newWeight })
                    ));

                    await client.models.Initiative.create({
                        organizationId: SafeOrgId,
                        title: itemText,
                        description: itemDescription,
                        owner: ownerObj,
                        state: { lifecycle: itemStatus, health: 'on_track', updatedAt: new Date().toISOString() },
                        linkedEntities: {
                            strategicObjectiveIds: [objective.id],
                            keyResultIds: [dialogState.parentId!]
                        },
                        heartbeatCadence: cadenceObj || undefined,
                        nextHeartbeatDue: nextDue || undefined,
                        weight: newWeight
                    });
                }
            } else {
                // UPDATE MODE
                const id = dialogState.id!;
                if (dialogState.type === 'objective') {
                    await client.models.StrategicObjective.update({
                        id,
                        title: itemText,
                        description: itemDescription,
                        // status: itemStatus as any, // Only if exposed on Object
                        owner: ownerObj,
                        heartbeatCadence: cadenceObj,
                        nextHeartbeatDue: nextDue || undefined
                    });
                    // Force reload/update for objective title changes visible immediately at top level?
                    // objective prop is stale. We might need to refetch it or just reload page.
                    window.location.reload();
                } else if (dialogState.type === 'outcome') {
                    await client.models.Outcome.update({
                        id,
                        title: itemText,
                        description: itemDescription,
                        status: itemStatus as any,
                        owner: ownerObj,
                        heartbeatCadence: cadenceObj,
                        nextHeartbeatDue: nextDue || undefined
                    });
                } else if (dialogState.type === 'kr') {
                    await client.models.KeyResult.update({
                        id,
                        statement: itemText,
                        status: itemStatus as any,
                        owners: ownerObj ? [ownerObj] : [],
                        metric: itemMetricName ? { name: itemMetricName } : null,
                        heartbeatCadence: cadenceObj,
                        nextHeartbeatDue: nextDue || undefined
                    });
                } else if (dialogState.type === 'initiative') {
                    await client.models.Initiative.update({
                        id,
                        title: itemText,
                        description: itemDescription,
                        state: { lifecycle: itemStatus, health: 'on_track', updatedAt: new Date().toISOString() },
                        owner: ownerObj,
                        heartbeatCadence: cadenceObj,
                        nextHeartbeatDue: nextDue || undefined
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
    const openWeightModal = (
        items: any[],
        parentTitle: string,
        childType: 'Outcome' | 'Key Result' | 'Initiative',
        modelClient: any
    ) => {
        setWeightModalState({
            open: true,
            items: items.map(i => ({ id: i.id, title: i.title || i.statement, weight: i.weight })),
            parentTitle,
            childType,
            onSave: async (updates) => {
                await Promise.all(updates.map(u => modelClient.update({ id: u.id, weight: u.weight })));
                await refreshTree();
            }
        });
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

    const StatusChip = ({ status }: { status: string }) => {
        if (!status) return null;
        let color: 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning' = 'default';
        if (['active', 'on_track'].includes(status.toLowerCase())) color = 'success';
        if (['draft', 'planned'].includes(status.toLowerCase())) color = 'info';
        if (['closed', 'completed'].includes(status.toLowerCase())) color = 'default';
        if (['cancelled', 'off_track', 'low'].includes(status.toLowerCase())) color = 'error';
        if (status.toLowerCase() === 'medium') color = 'warning';
        if (status.toLowerCase() === 'high') color = 'success';

        return <Chip label={status} size="small" color={color} sx={{ height: 20, fontSize: '0.65rem', textTransform: 'uppercase' }} />;
    };

    const TrendIcon = ({ trend }: { trend?: string }) => {
        if (!trend) return null;
        let icon = "→";
        let color = "text.secondary";
        if (trend === 'IMPROVING') { icon = "↑"; color = "success.main"; }
        if (trend === 'DECLINING') { icon = "↓"; color = "error.main"; }
        return <Typography component="span" fontWeight="bold" color={color} sx={{ ml: 0.5 }}>{icon}</Typography>;
    };

    const HeartbeatStatus = ({ due }: { due?: string | null }) => {
        if (!due) return null;
        const isLate = new Date(due) < new Date();
        return (
            <Chip
                label={isLate ? "Heartbeat Late" : `Next Due: ${new Date(due).toLocaleDateString()}`}
                color={isLate ? "error" : "default"}
                size="small"
                variant={isLate ? "filled" : "outlined"}
                sx={{ height: 20, fontSize: '0.65rem' }}
            />
        );
    };

    return (
        <>
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
                            <Tooltip title="Start Heartbeat">
                                <IconButton size="small" color="primary" onClick={() => openHeartbeatWizard('objective', objective)}>
                                    <MonitorHeartIcon fontSize="small" />
                                </IconButton>
                            </Tooltip>
                            {outcomes.length > 0 && (
                                <Tooltip title="Adjust Outcome Weights">
                                    <IconButton size="small" onClick={() => openWeightModal(outcomes, objective.title, 'Outcome', client.models.Outcome)}>
                                        <BalanceIcon fontSize="small" />
                                    </IconButton>
                                </Tooltip>
                            )}
                            <Tooltip title="View History">
                                <IconButton size="small" onClick={() => setHistoryState({ open: true, item: objective, type: 'objective' })}>
                                    <HistoryIcon fontSize="small" />
                                </IconButton>
                            </Tooltip>
                            <Tooltip title="Edit Objective"><IconButton size="small" onClick={() => openDialog('edit', 'objective' as any, '', objective)}><EditIcon fontSize="small" /></IconButton></Tooltip>
                            <Tooltip title="Delete Objective"><IconButton size="small" onClick={() => handleDelete('objective', objective.id)}><DeleteIcon fontSize="small" /></IconButton></Tooltip>
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
                            <HeartbeatStatus due={objective.nextHeartbeatDue} />
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
                                    Outcomes
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
                                                    <Typography variant="subtitle1" fontWeight="600" color="text.primary">
                                                        {outcome.title}
                                                    </Typography>
                                                    <Chip label={`${outcome.weight || 0}%`} size="small" variant="outlined" sx={{ height: 20, fontSize: '0.7rem' }} />
                                                    {outcome.latestHeartbeat?.ownerInput?.ownerConfidence && (
                                                        <Tooltip title="Latest Confidence & Trend">
                                                            <Box display="flex" alignItems="center">
                                                                <StatusChip status={outcome.latestHeartbeat.ownerInput.ownerConfidence} />
                                                                <TrendIcon trend={outcome.latestHeartbeat.systemAssessment?.confidenceTrend} />
                                                            </Box>
                                                        </Tooltip>
                                                    )}
                                                    <HeartbeatStatus due={outcome.nextHeartbeatDue} />
                                                    <StatusChip status={outcome.status} />
                                                    <OwnerChip owner={outcome.owner} />
                                                </Stack>
                                                <Stack direction="row" spacing={1}>
                                                    <Tooltip title="Log Heartbeat">
                                                        <IconButton size="small" color="primary" onClick={() => openHeartbeatWizard('outcome', outcome)}>
                                                            <MonitorHeartIcon fontSize="small" />
                                                        </IconButton>
                                                    </Tooltip>
                                                    <Tooltip title="View History">
                                                        <IconButton size="small" onClick={() => setHistoryState({ open: true, item: outcome, type: 'outcome' })}>
                                                            <HistoryIcon fontSize="small" />
                                                        </IconButton>
                                                    </Tooltip>

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
                                                    {outcome.keyResults?.length > 0 && (
                                                        <Tooltip title="Adjust KR Weights">
                                                            <IconButton size="small" onClick={() => openWeightModal(outcome.keyResults, outcome.title, 'Key Result', client.models.KeyResult)}>
                                                                <BalanceIcon fontSize="small" />
                                                            </IconButton>
                                                        </Tooltip>
                                                    )}
                                                </Stack>
                                            </Box>

                                            <Box p={2}>
                                                {outcome.description && <Typography variant="body2" color="text.secondary" gutterBottom>{outcome.description}</Typography>}
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
                                                                            <Chip label={`${kr.weight || 0}%`} size="small" variant="outlined" sx={{ height: 20, fontSize: '0.7rem' }} />
                                                                            {kr.latestHeartbeat?.ownerInput?.ownerConfidence && (
                                                                                <Tooltip title="Latest Confidence & Trend">
                                                                                    <Box display="flex" alignItems="center">
                                                                                        <StatusChip status={kr.latestHeartbeat.ownerInput.ownerConfidence} />
                                                                                        <TrendIcon trend={kr.latestHeartbeat.systemAssessment?.confidenceTrend} />
                                                                                    </Box>
                                                                                </Tooltip>
                                                                            )}
                                                                            <HeartbeatStatus due={kr.nextHeartbeatDue} />
                                                                            <StatusChip status={kr.status} />
                                                                            {kr.owners && kr.owners.length > 0 && <OwnerChip owner={kr.owners[0]} />}
                                                                        </Stack>
                                                                        {kr.metric?.name && (
                                                                            <Typography variant="caption" display="block" color="text.secondary">
                                                                                Metric: {kr.metric.name}
                                                                            </Typography>
                                                                        )}
                                                                    </Box>
                                                                    <Tooltip title="View History">
                                                                        <IconButton size="small" sx={{ p: 0.5 }} onClick={() => setHistoryState({ open: true, item: kr, type: 'kr' })}>
                                                                            <HistoryIcon sx={{ fontSize: 14 }} />
                                                                        </IconButton>
                                                                    </Tooltip>
                                                                    <Tooltip title="Edit KR"><IconButton size="small" sx={{ p: 0.5 }} onClick={() => openDialog('edit', 'kr', '', kr)}><EditIcon sx={{ fontSize: 14 }} /></IconButton></Tooltip>
                                                                    <Tooltip title="Delete KR"><IconButton size="small" sx={{ p: 0.5 }} onClick={() => handleDelete('kr', kr.id)}><DeleteIcon sx={{ fontSize: 14 }} /></IconButton></Tooltip>
                                                                    <Button
                                                                        size="small"
                                                                        color="secondary"
                                                                        startIcon={<AddIcon />}
                                                                        onClick={() => openDialog('create', 'initiative', kr.id)}
                                                                    >
                                                                        Add Init
                                                                    </Button>
                                                                    {kr.initiatives?.length > 0 && (
                                                                        <Tooltip title="Adjust Initiative Weights">
                                                                            <IconButton size="small" sx={{ p: 0.5 }} onClick={() => openWeightModal(kr.initiatives, kr.statement, 'Initiative', client.models.Initiative)}>
                                                                                <BalanceIcon sx={{ fontSize: 14 }} />
                                                                            </IconButton>
                                                                        </Tooltip>
                                                                    )}
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
                                                                                        <Chip label={`${init.weight || 0}%`} size="small" variant="outlined" sx={{ height: 18, fontSize: '0.65rem' }} />
                                                                                        {init.latestHeartbeat?.ownerInput?.ownerConfidence && (
                                                                                            <Tooltip title="Latest Confidence & Trend">
                                                                                                <Box display="flex" alignItems="center">
                                                                                                    <StatusChip status={init.latestHeartbeat.ownerInput.ownerConfidence} />
                                                                                                    <TrendIcon trend={init.latestHeartbeat.systemAssessment?.confidenceTrend} />
                                                                                                </Box>
                                                                                            </Tooltip>
                                                                                        )}
                                                                                        <HeartbeatStatus due={init.nextHeartbeatDue} />
                                                                                        <StatusChip status={init.state?.lifecycle} />
                                                                                        <OwnerChip owner={init.owner} />
                                                                                        <Box flexGrow={1} />

                                                                                        <Tooltip title="Log Heartbeat">
                                                                                            <IconButton size="small" color="primary" onClick={() => openHeartbeatWizard('initiative', init)}>
                                                                                                <MonitorHeartIcon fontSize="small" />
                                                                                            </IconButton>
                                                                                        </Tooltip>
                                                                                        <Tooltip title="View History">
                                                                                            <IconButton size="small" onClick={() => setHistoryState({ open: true, item: init, type: 'initiative' })}>
                                                                                                <HistoryIcon fontSize="small" />
                                                                                            </IconButton>
                                                                                        </Tooltip>

                                                                                        <Tooltip title="Edit Initiative"><IconButton size="small" sx={{ p: 0.5 }} onClick={() => openDialog('edit', 'initiative', '', init)}><EditIcon sx={{ fontSize: 14 }} /></IconButton></Tooltip>
                                                                                        <Tooltip title="Delete Initiative"><IconButton size="small" sx={{ p: 0.5 }} onClick={() => handleDelete('initiative', init.id)}><DeleteIcon sx={{ fontSize: 14 }} /></IconButton></Tooltip>
                                                                                    </Stack>
                                                                                    {init.description && <Typography variant="caption" color="text.secondary" display="block" mt={0.5}>{init.description}</Typography>}
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

            {/* Item Dialog (Create/Edit) */}
            <Dialog
                open={dialogState.open}
                onClose={() => setDialogState({ ...dialogState, open: false })}
                maxWidth="sm"
                fullWidth
            >
                <DialogTitle>
                    {dialogState.mode === 'create' ? 'Add' : 'Edit'} {
                        dialogState.type === 'outcome' ? 'Outcome' :
                            dialogState.type === 'kr' ? 'Key Result' :
                                dialogState.type === 'initiative' ? 'Initiative' :
                                    'Strategic Objective'
                    }
                </DialogTitle>
                <DialogContent>
                    <Box display="flex" flexDirection="column" gap={2} pt={1}>
                        <TextField
                            autoFocus
                            label={
                                dialogState.type === 'outcome' ? 'Outcome Title' :
                                    dialogState.type === 'kr' ? 'KR Statement' :
                                        dialogState.type === 'initiative' ? 'Initiative Title' :
                                            'Objective Title'
                            }
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
                        {/* Description for non-KR */}
                        {dialogState.type !== 'kr' && (
                            <TextField
                                label="Description"
                                fullWidth
                                multiline
                                rows={3}
                                variant="outlined"
                                value={itemDescription}
                                onChange={(e) => setItemDescription(e.target.value)}
                            />
                        )}
                        {/* Status Select */}
                        <FormControl fullWidth>
                            <InputLabel id="status-select-label">Status</InputLabel>
                            <Select
                                labelId="status-select-label"
                                value={itemStatus}
                                label="Status"
                                onChange={(e) => setItemStatus(e.target.value)}
                            >
                                {dialogState.type === 'initiative' ? [
                                    <MenuItem key="planned" value="planned">Planned</MenuItem>,
                                    <MenuItem key="active" value="active">Active</MenuItem>,
                                    <MenuItem key="completed" value="completed">Completed</MenuItem>,
                                    <MenuItem key="paused" value="paused">Paused</MenuItem>,
                                    <MenuItem key="cancelled" value="cancelled">Cancelled</MenuItem>
                                ] : [
                                    <MenuItem key="active" value="active">Active</MenuItem>,
                                    <MenuItem key="draft" value="draft">Draft</MenuItem>,
                                    <MenuItem key="closed" value="closed">Closed</MenuItem>,
                                    <MenuItem key="archived" value="archived">Archived</MenuItem>
                                ]}
                            </Select>
                        </FormControl>

                        {/* Heartbeat Cadence */}
                        <Box border={1} borderColor="divider" borderRadius={1} p={2}>
                            <Typography variant="subtitle2" gutterBottom>Heartbeat Cadence</Typography>
                            <Stack direction="row" spacing={2}>
                                <FormControl fullWidth size="small">
                                    <InputLabel>Frequency</InputLabel>
                                    <Select
                                        value={itemCadenceFreq}
                                        label="Frequency"
                                        onChange={(e) => setItemCadenceFreq(e.target.value)}
                                    >
                                        <MenuItem value=""><em>None</em></MenuItem>
                                        <MenuItem value="DAILY">Daily</MenuItem>
                                        <MenuItem value="WEEKLY">Weekly</MenuItem>
                                        <MenuItem value="BIWEEKLY">Bi-Weekly</MenuItem>
                                        <MenuItem value="MONTHLY">Monthly</MenuItem>
                                    </Select>
                                </FormControl>
                                {itemCadenceFreq && itemCadenceFreq !== 'DAILY' && (
                                    <FormControl fullWidth size="small">
                                        <InputLabel>Day</InputLabel>
                                        <Select
                                            value={itemCadenceDay}
                                            label="Day"
                                            onChange={(e) => setItemCadenceDay(e.target.value)}
                                        >
                                            <MenuItem value="MON">Mon</MenuItem>
                                            <MenuItem value="TUES">Tue</MenuItem>
                                            <MenuItem value="WED">Wed</MenuItem>
                                            <MenuItem value="THU">Thu</MenuItem>
                                            <MenuItem value="FRI">Fri</MenuItem>
                                            <MenuItem value="SAT">Sat</MenuItem>
                                            <MenuItem value="SUN">Sun</MenuItem>
                                        </Select>
                                    </FormControl>
                                )}
                                {itemCadenceFreq && (
                                    <FormControl fullWidth size="small">
                                        <InputLabel>Hour (0-23)</InputLabel>
                                        <Select
                                            value={itemCadenceHour}
                                            label="Hour (0-23)"
                                            onChange={(e) => setItemCadenceHour(Number(e.target.value))}
                                        >
                                            {[...Array(24)].map((_, i) => (
                                                <MenuItem key={i} value={i}>{i}:00</MenuItem>
                                            ))}
                                        </Select>
                                    </FormControl>
                                )}
                            </Stack>
                        </Box>
                        {/* KR Metric Name */}
                        {dialogState.type === 'kr' && (
                            <TextField
                                label="Metric Name (Optional)"
                                fullWidth
                                variant="outlined"
                                value={itemMetricName}
                                onChange={(e) => setItemMetricName(e.target.value)}
                                placeholder="e.g. NPS Score"
                            />
                        )}

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

            {heartbeatState.item && (
                <HeartbeatWizard
                    open={heartbeatState.open}
                    onClose={() => setHeartbeatState({ ...heartbeatState, open: false })}
                    item={heartbeatState.item}
                    itemType={heartbeatState.type}
                    onComplete={refreshTree}
                />
            )}

            {historyState.item && (
                <HeartbeatHistoryDialog
                    open={historyState.open}
                    onClose={() => setHistoryState({ ...historyState, open: false })}
                    item={historyState.item}
                    itemType={historyState.type}
                />
            )}

            <WeightDistributionModal
                open={weightModalState.open}
                onClose={() => setWeightModalState(prev => ({ ...prev, open: false }))}
                items={weightModalState.items}
                parentTitle={weightModalState.parentTitle}
                childType={weightModalState.childType}
                onSave={weightModalState.onSave}
            />
        </>
    );
}
