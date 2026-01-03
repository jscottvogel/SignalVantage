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
    Tooltip,
    Autocomplete,
    Collapse
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import AddIcon from '@mui/icons-material/Add';
import PersonIcon from '@mui/icons-material/Person';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import MonitorHeartIcon from '@mui/icons-material/MonitorHeart';
import HistoryIcon from '@mui/icons-material/History';
import BalanceIcon from '@mui/icons-material/Balance';
import LinkIcon from '@mui/icons-material/Link';
import ExpandLess from '@mui/icons-material/ExpandLess';
import ExpandMore from '@mui/icons-material/ExpandMore';
import SaveIcon from '@mui/icons-material/Save';
import HeartbeatWizard from './HeartbeatWizard';
import HeartbeatHistoryDialog from './HeartbeatHistoryDialog';
import WeightDistributionModal from './WeightDistributionModal';
import { logger } from '../utils/logger';
import { fetchObjectiveHierarchy } from '../utils/objectiveDataUtils';

const client = generateClient<Schema>();

const METRIC_OPTIONS = [
    { group: 'Customer & Growth Metrics', label: 'Net Promoter Score (NPS)' },
    { group: 'Customer & Growth Metrics', label: 'Customer Satisfaction (CSAT)' },
    { group: 'Customer & Growth Metrics', label: 'Customer Effort Score (CES)' },
    { group: 'Customer & Growth Metrics', label: 'Customer Retention Rate' },
    { group: 'Customer & Growth Metrics', label: 'Churn Rate' },
    { group: 'Customer & Growth Metrics', label: 'Customer Lifetime Value (CLV / LTV)' },
    { group: 'Customer & Growth Metrics', label: 'Customer Acquisition Cost (CAC)' },
    { group: 'Product & Adoption Metrics', label: 'Monthly Active Users (MAU) / Daily Active Users (DAU)' },
    { group: 'Product & Adoption Metrics', label: 'DAU/MAU Ratio' },
    { group: 'Product & Adoption Metrics', label: 'Activation Rate' },
    { group: 'Product & Adoption Metrics', label: 'Feature Adoption Rate' },
    { group: 'Product & Adoption Metrics', label: 'Time to First Value (TTFV)' },
    { group: 'Product & Adoption Metrics', label: 'Conversion Rate' },
    { group: 'Revenue & Financial Metrics', label: 'Revenue Growth Rate' },
    { group: 'Revenue & Financial Metrics', label: 'Annual Recurring Revenue (ARR) / Monthly Recurring Revenue (MRR)' },
    { group: 'Revenue & Financial Metrics', label: 'Average Revenue Per User (ARPU)' },
    { group: 'Revenue & Financial Metrics', label: 'Gross Margin' },
    { group: 'Revenue & Financial Metrics', label: 'Operating Margin' },
    { group: 'Revenue & Financial Metrics', label: 'Cost to Serve' },
    { group: 'Revenue & Financial Metrics', label: 'Return on Investment (ROI)' },
    { group: 'Operational & Delivery Metrics', label: 'On-Time Delivery Rate' },
    { group: 'Operational & Delivery Metrics', label: 'Cycle Time / Lead Time' },
    { group: 'Operational & Delivery Metrics', label: 'Throughput' },
    { group: 'Operational & Delivery Metrics', label: 'Dependency Resolution Rate' },
    { group: 'Operational & Delivery Metrics', label: 'Risk Burn-Down' },
    { group: 'Operational & Delivery Metrics', label: 'Initiative Health' },
    { group: 'Quality & Reliability Metrics', label: 'Defect Rate' },
    { group: 'Quality & Reliability Metrics', label: 'Error Rate' },
    { group: 'Quality & Reliability Metrics', label: 'System Availability / Uptime' },
    { group: 'Quality & Reliability Metrics', label: 'Mean Time to Detect (MTTD)' },
    { group: 'Quality & Reliability Metrics', label: 'Mean Time to Recover (MTTR)' },
    { group: 'People & Execution Health', label: 'Employee Engagement Score' },
    { group: 'People & Execution Health', label: 'Attrition / Retention Rate' },
    { group: 'People & Execution Health', label: 'Capacity Utilization' },
    { group: 'People & Execution Health', label: 'Delivery Predictability' },
    { group: 'People & Execution Health', label: 'Confidence Trend' },
    { group: 'Strategy & Outcome Metrics', label: 'OKR Achievement Rate' },
    { group: 'Strategy & Outcome Metrics', label: 'Outcome Realization Rate' },
    { group: 'Strategy & Outcome Metrics', label: 'Value Delivered vs. Planned' },
    { group: 'Strategy & Outcome Metrics', label: 'Strategic Alignment Score' },
];

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


type OutcomeWithChildren = Omit<Schema['Outcome']['type'], 'keyResults'> & {
    keyResults: (Omit<Schema['KeyResult']['type'], 'initiatives'> & {
        initiatives: Schema['Initiative']['type'][]
    })[]
};

type StrategyItem =
    | Schema['StrategicObjective']['type']
    | Schema['Outcome']['type']
    | Schema['KeyResult']['type']
    | Schema['Initiative']['type'];

export function ObjectiveDetailModal({ objective, onClose }: Props) {
    const [localObjective, setLocalObjective] = useState(objective);
    const [outcomes, setOutcomes] = useState<OutcomeWithChildren[]>([]);
    const [loading, setLoading] = useState(true);
    const [members, setMembers] = useState<(Schema['Membership']['type'] & { profile?: Schema['UserProfile']['type'] | null })[]>([]);
    const [risks, setRisks] = useState<Schema['Risk']['type'][]>([]);
    const [dependencies, setDependencies] = useState<Schema['Dependency']['type'][]>([]);
    const [dependenciesExpanded, setDependenciesExpanded] = useState(true);
    const [editingDependency, setEditingDependency] = useState<Schema['Dependency']['type'] | null>(null);
    const [isCreatingDependency, setIsCreatingDependency] = useState(false);
    const [newDependency, setNewDependency] = useState({ description: '', owner: '', state: 'ACTIVE', status: 'ON_TRACK', dueDate: '' });



    const handleDeleteRisk = async (id: string) => {
        if (!window.confirm("Are you sure you want to delete this risk?")) return;
        try {
            await client.models.Risk.delete({ id });
            await refreshTree();
        } catch (e) {
            console.error(e);
            alert("Failed to delete risk.");
        }
    };

    const handleUpdateRisk = async (riskId: string, updates: { description: string, impact: Schema['Risk']['type']['impact'], probability: number, roamStatus: Schema['Risk']['type']['roamStatus'] }) => {
        try {
            await client.models.Risk.update({
                id: riskId,
                ...updates
            });
            setEditingRisk(null);
            await refreshTree();
            await refreshTree();
        } catch (e) {
            logger.error("Failed to update risk", e);
            alert("Failed to update risk");
        }
    };

    const handleCreateRisk = async () => {
        if (!newRisk.description) return;
        try {
            await client.models.Risk.create({
                ...newRisk,
                organizationId: objective.organizationId,
                strategicObjectiveId: objective.id, // Attach to current objective
                impact: newRisk.impact,
                probability: newRisk.probability,
                roamStatus: newRisk.roamStatus
            });
            setIsCreatingRisk(false);
            setNewRisk({ description: '', impact: 'LOW', probability: 50, roamStatus: 'OWNED' });
            await refreshTree();
        } catch (e) {
            logger.error("Failed to create risk", e);
            alert("Failed to create risk");
        }
    };

    const handleCreateDependency = async () => {
        if (!newDependency.description) return;
        try {
            await client.models.Dependency.create({
                ...newDependency,
                organizationId: objective.organizationId,
                strategicObjectiveId: objective.id, // Default to attaching to current objective
                state: newDependency.state as Schema['Dependency']['type']['state'],
                status: newDependency.status as Schema['Dependency']['type']['status'],
                dueDate: newDependency.dueDate || undefined
            });
            setIsCreatingDependency(false);
            setNewDependency({ description: '', owner: '', state: 'ACTIVE', status: 'ON_TRACK', dueDate: '' });
            await refreshTree();
        } catch (e) {
            logger.error("Failed to create dependency", e);
            alert("Failed to create dependency");
        }
    };

    const handleUpdateDependency = async (depId: string, updates: Partial<Schema['Dependency']['type']>) => {
        try {
            await client.models.Dependency.update({
                id: depId,
                ...updates
            });
            setEditingDependency(null);
            await refreshTree();
        } catch (e) {
            logger.error("Failed to update dependency", e);
            alert("Failed to update dependency");
        }
    };

    const handleDeleteDependency = async (id: string) => {
        if (!window.confirm("Are you sure you want to delete this dependency?")) return;
        try {
            await client.models.Dependency.delete({ id });
            await refreshTree();
        } catch (e) {
            console.error(e);
            alert("Failed to delete dependency.");
        }
    };


    useEffect(() => {
        setLocalObjective(objective);
    }, [objective]);

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
    const [itemMetricUnit, setItemMetricUnit] = useState('');
    const [selectedOwnerId, setSelectedOwnerId] = useState('');
    // Cadence State
    const [itemCadenceFreq, setItemCadenceFreq] = useState('');
    const [itemCadenceDay, setItemCadenceDay] = useState('FRI');
    const [itemCadenceHour, setItemCadenceHour] = useState(9); // 9 AM default
    const [itemProjectLink, setItemProjectLink] = useState('');







    const [isSubmitting, setIsSubmitting] = useState(false);

    // Heartbeat Wizard State
    const [heartbeatState, setHeartbeatState] = useState<{ open: boolean, item: StrategyItem | null, type: 'initiative' | 'outcome' | 'objective' | 'kr' }>({
        open: false,
        item: null,
        type: 'initiative'
    });

    const [historyState, setHistoryState] = useState<{ open: boolean, item: StrategyItem | null, type: 'initiative' | 'outcome' | 'objective' | 'kr' }>({
        open: false,
        item: null,
        type: 'initiative'
    });

    const [risksExpanded, setRisksExpanded] = useState(true);
    const [outcomesExpanded, setOutcomesExpanded] = useState(true);
    const [editingRisk, setEditingRisk] = useState<Schema['Risk']['type'] | null>(null);
    const [isCreatingRisk, setIsCreatingRisk] = useState(false);
    const [newRisk, setNewRisk] = useState({ description: '', impact: 'LOW' as Schema['Risk']['type']['impact'], probability: 50, roamStatus: 'OWNED' as Schema['Risk']['type']['roamStatus'] });

    const [weightModalState, setWeightModalState] = useState<{
        open: boolean;
        items: { id: string; title?: string | null; statement?: string | null; weight?: number | null }[];
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
            const data = await fetchObjectiveHierarchy(client, objective);

            if (data.refreshedObjective) setLocalObjective(data.refreshedObjective);
            setRisks(data.risks);
            setOutcomes(data.outcomes);
            setDependencies(data.dependencies);

            // Fetch Organization & Members (kept separate as it's UI/Picker specific, not strictly data hierarchy)
            const { data: org } = await objective.organization();
            if (org) {
                const { data: membershipList } = await org.members();
                const membersWithProfiles = await Promise.all(
                    membershipList.map(async (m) => {
                        let profile = null;
                        const { data: profileRel } = await m.user();
                        if (profileRel) {
                            profile = profileRel;
                        } else if (m.userProfileId) {
                            const { data: profileDirect } = await client.models.UserProfile.get({ id: m.userProfileId });
                            profile = profileDirect;
                        }
                        return { ...m, profile };
                    })
                );
                setMembers(membersWithProfiles);
            }

        } catch (e) {
            logger.error("Error fetching details", e);
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
        item?: StrategyItem | null
    ) => {
        let initText = '';
        let initOwner = '';
        let initDesc = '';
        let initProjectLink = '';
        let initStatus = 'active';
        let initMetricName = '';
        let initMetricUnit = '';
        let initFreq = '';
        let initDay = 'FRI';
        let initHour = 9;

        if (mode === 'edit' && item) {
            initText = 'title' in item ? item.title : (item as Schema['KeyResult']['type']).statement || '';
            // Handle owner: item.owner (single) or item.owners[0] (array)
            const owner = item.owner || (item.owners && item.owners[0]);
            initOwner = owner?.userId || '';
            initDesc = item.description || '';
            initProjectLink = item.projectLink || '';

            if (type === 'initiative') {
                initStatus = item.state?.lifecycle || 'planned';
            } else {
                initStatus = item.status || 'active';
            }

            if (type === 'kr') {
                initMetricName = item.metric?.name || '';
                initMetricUnit = item.metric?.unit || '';
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
        setItemProjectLink(initProjectLink);
        setItemStatus(initStatus);
        setItemMetricName(initMetricName);
        setItemMetricUnit(initMetricUnit);
        setSelectedOwnerId(initOwner);
        setItemCadenceFreq(initFreq);
        setItemCadenceDay(initDay);
        setItemCadenceHour(initHour);
    };

    const openHeartbeatWizard = (type: 'initiative' | 'outcome' | 'objective' | 'kr', item: StrategyItem) => {
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
            logger.error("Delete failed", e);
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
                frequency: itemCadenceFreq as Schema['HeartbeatCadence']['type']['frequency'],
                dayOfWeek: (itemCadenceFreq !== 'DAILY' ? itemCadenceDay : null) as Schema['HeartbeatCadence']['type']['dayOfWeek'],
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

            // Construct Metric Object
            const metricObj = itemMetricName ? {
                name: itemMetricName,
                unit: itemMetricUnit || undefined
            } : null;

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
                        status: itemStatus as Schema['Outcome']['type']['status'],
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

                    await Promise.all(siblings.map((s) =>
                        client.models.KeyResult.update({ id: s.id, weight: newWeight })
                    ));

                    await client.models.KeyResult.create({
                        organizationId: SafeOrgId,
                        strategicObjectiveId: objective.id,
                        outcomeId: dialogState.parentId!,
                        statement: itemText,
                        status: itemStatus as Schema['KeyResult']['type']['status'],
                        owners: ownerObj ? [ownerObj] : [],
                        metric: metricObj,
                        heartbeatCadence: cadenceObj || undefined,
                        nextHeartbeatDue: nextDue || undefined,
                        weight: newWeight
                    });
                } else if (dialogState.type === 'initiative') {
                    // Balancing Logic for Initiative
                    // Need to find siblings.
                    // Flatten KRs to find parent KR
                    let siblings: Schema['Initiative']['type'][] = [];
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

                    await Promise.all(siblings.map((s) =>
                        client.models.Initiative.update({ id: s.id, weight: newWeight })
                    ));

                    await client.models.Initiative.create({
                        organizationId: SafeOrgId,
                        title: itemText,
                        description: itemDescription,
                        projectLink: itemProjectLink || undefined,
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
                        status: itemStatus as Schema['Outcome']['type']['status'],
                        owner: ownerObj,
                        heartbeatCadence: cadenceObj,
                        nextHeartbeatDue: nextDue || undefined
                    });
                } else if (dialogState.type === 'kr') {
                    await client.models.KeyResult.update({
                        id,
                        statement: itemText,
                        status: itemStatus as Schema['KeyResult']['type']['status'],
                        owners: ownerObj ? [ownerObj] : [],
                        metric: metricObj,
                        heartbeatCadence: cadenceObj,
                        nextHeartbeatDue: nextDue || undefined
                    });
                } else if (dialogState.type === 'initiative') {
                    await client.models.Initiative.update({
                        id,
                        title: itemText,
                        description: itemDescription,
                        projectLink: itemProjectLink || undefined,
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
            logger.error("Operation failed", e);
            alert("Failed to save item.");
        } finally {
            setIsSubmitting(false);
        }
    };
    const openWeightModal = (
        items: { id: string; weight?: number | null; title?: string | null; statement?: string | null }[],
        parentTitle: string,
        childType: 'Outcome' | 'Key Result' | 'Initiative',
        modelClient: { update: (args: { id: string, weight: number }) => Promise<unknown> }
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

    const OwnerChip = ({ owner }: { owner: { displayName?: string | null } | null | undefined }) => {
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

    const StatusChip = ({ status }: { status: string | number | undefined | null }) => {
        if (status === undefined || status === null || status === '') return null;
        const statusStr = String(status);
        const lowerStatus = statusStr.toLowerCase();

        let color: 'default' | 'primary' | 'secondary' | 'error' | 'info' | 'success' | 'warning' = 'default';
        if (['active', 'on_track'].includes(lowerStatus)) color = 'success';
        if (['draft', 'planned'].includes(lowerStatus)) color = 'info';
        if (['closed', 'completed'].includes(lowerStatus)) color = 'default';
        if (['cancelled', 'off_track', 'low'].includes(lowerStatus)) color = 'error';
        if (lowerStatus === 'medium') color = 'warning';
        if (lowerStatus === 'high') color = 'success';

        return <Chip label={statusStr} size="small" color={color} sx={{ height: 20, fontSize: '0.65rem', textTransform: 'uppercase' }} />;
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
                            <Typography variant="h5" fontWeight="bold" color="primary.main">{localObjective.title}</Typography>
                            {localObjective.owner && <OwnerChip owner={localObjective.owner} />}
                            <Tooltip title="Start Heartbeat">
                                <IconButton size="small" color="primary" onClick={() => openHeartbeatWizard('objective', localObjective)}>
                                    <MonitorHeartIcon fontSize="small" />
                                </IconButton>
                            </Tooltip>
                            {outcomes.length > 0 && (
                                <Tooltip title="Adjust Outcome Weights">
                                    <IconButton size="small" onClick={() => openWeightModal(outcomes, localObjective.title, 'Outcome', client.models.Outcome)}>
                                        <BalanceIcon fontSize="small" />
                                    </IconButton>
                                </Tooltip>
                            )}
                            <Tooltip title="View History">
                                <IconButton size="small" onClick={() => setHistoryState({ open: true, item: localObjective, type: 'objective' })}>
                                    <HistoryIcon fontSize="small" />
                                </IconButton>
                            </Tooltip>
                            <Tooltip title="Edit Objective"><IconButton size="small" onClick={() => openDialog('edit', 'objective', '', localObjective)}><EditIcon fontSize="small" /></IconButton></Tooltip>
                            <Tooltip title="Delete Objective"><IconButton size="small" onClick={() => handleDelete('objective', localObjective.id)}><DeleteIcon fontSize="small" /></IconButton></Tooltip>
                        </Stack>
                    </Box>
                    <IconButton onClick={onClose} aria-label="close"><CloseIcon /></IconButton>
                </DialogTitle>

                <DialogContent sx={{ p: 0 }}>
                    {/* Header / Context Area */}
                    <Box p={3} bgcolor="background.paper" mb={1} sx={{ borderBottom: 1, borderColor: 'divider' }}>
                        <Typography variant="body1" color="text.secondary" paragraph>
                            {localObjective.description || "No description provided."}
                        </Typography>
                        <Stack direction="row" spacing={1}>
                            <HeartbeatStatus due={localObjective.nextHeartbeatDue} />
                        </Stack>
                    </Box>

                    {/* Risk Register Section */}
                    <Paper elevation={0} sx={{ mx: 3, mb: 3, border: 1, borderColor: 'divider', bgcolor: 'grey.50' }}>
                        <Box
                            px={2}
                            py={1}
                            display="flex"
                            justifyContent="space-between"
                            alignItems="center"
                            borderBottom={risksExpanded ? 1 : 0}
                            borderColor="divider"
                            onClick={() => setRisksExpanded(!risksExpanded)}
                            sx={{ cursor: 'pointer', '&:hover': { bgcolor: 'grey.100' } }}
                        >
                            <Typography variant="subtitle2" fontWeight="bold" color="text.secondary">RISK REGISTER</Typography>
                            <Stack direction="row" spacing={1}>
                                <Button size="small" startIcon={<AddIcon />} onClick={(e) => { e.stopPropagation(); setIsCreatingRisk(true); setRisksExpanded(true); }}>
                                    Add
                                </Button>
                                <IconButton size="small" onClick={(e) => { e.stopPropagation(); setRisksExpanded(!risksExpanded); }}>
                                    {risksExpanded ? <ExpandLess /> : <ExpandMore />}
                                </IconButton>
                            </Stack>
                        </Box>
                        <Collapse in={risksExpanded} timeout="auto" unmountOnExit>
                            <Stack spacing={0}>
                                {isCreatingRisk && (
                                    <Box p={1.5} borderBottom={1} borderColor="divider" bgcolor="white">
                                        <Typography variant="caption" color="text.secondary" fontWeight="bold" mb={1} display="block">NEW RISK</Typography>
                                        <Stack spacing={1}>
                                            <TextField
                                                fullWidth
                                                size="small"
                                                value={newRisk.description}
                                                onChange={(e) => setNewRisk({ ...newRisk, description: e.target.value })}
                                                label="Description"
                                                autoFocus
                                            />
                                            <Stack direction="row" spacing={1}>
                                                <FormControl size="small" sx={{ minWidth: 100 }}>
                                                    <InputLabel>Impact</InputLabel>
                                                    <Select
                                                        value={newRisk.impact}
                                                        label="Impact"
                                                        onChange={(e) => setNewRisk({ ...newRisk, impact: e.target.value as Schema['Risk']['type']['impact'] })}
                                                    >
                                                        <MenuItem value="LOW">Low</MenuItem>
                                                        <MenuItem value="MEDIUM">Medium</MenuItem>
                                                        <MenuItem value="HIGH">High</MenuItem>
                                                        <MenuItem value="CRITICAL">Critical</MenuItem>
                                                    </Select>
                                                </FormControl>
                                                <TextField
                                                    label="Prob (%)"
                                                    type="number"
                                                    size="small"
                                                    sx={{ width: 100 }}
                                                    value={newRisk.probability}
                                                    onChange={(e) => setNewRisk({ ...newRisk, probability: parseInt(e.target.value) || 0 })}
                                                />
                                                <FormControl size="small" sx={{ minWidth: 120 }}>
                                                    <InputLabel>ROAM</InputLabel>
                                                    <Select
                                                        value={newRisk.roamStatus}
                                                        label="ROAM"
                                                        onChange={(e) => setNewRisk({ ...newRisk, roamStatus: e.target.value as Schema['Risk']['type']['roamStatus'] })}
                                                    >
                                                        <MenuItem value="RESOLVED">Resolved</MenuItem>
                                                        <MenuItem value="OWNED">Owned</MenuItem>
                                                        <MenuItem value="ACCEPTED">Accepted</MenuItem>
                                                        <MenuItem value="MITIGATED">Mitigated</MenuItem>
                                                    </Select>
                                                </FormControl>
                                                <Box flexGrow={1} />
                                                <Button size="small" variant="contained" onClick={handleCreateRisk} disabled={!newRisk.description}>
                                                    Save
                                                </Button>
                                                <Button size="small" onClick={() => setIsCreatingRisk(false)}>
                                                    Cancel
                                                </Button>
                                            </Stack>
                                        </Stack>
                                    </Box>
                                )}
                                {risks.length === 0 && !isCreatingRisk && (
                                    <Box p={2} textAlign="center">
                                        <Typography variant="body2" color="text.secondary" fontStyle="italic">No risks identified. Click 'Add' to log a risk.</Typography>
                                    </Box>
                                )}
                                {risks.map((risk, index) => {
                                    const isEditing = editingRisk?.id === risk.id;
                                    return (
                                        <Box key={risk.id} p={1.5} display="flex" justifyContent="space-between" alignItems="center" borderBottom={index !== risks.length - 1 ? 1 : 0} borderColor="divider">
                                            {isEditing ? (
                                                <Stack spacing={1} width="100%">
                                                    <TextField
                                                        fullWidth
                                                        size="small"
                                                        value={editingRisk.description}
                                                        onChange={(e) => setEditingRisk({ ...editingRisk, description: e.target.value })}
                                                        label="Description"
                                                    />
                                                    <Stack direction="row" spacing={1}>
                                                        <FormControl size="small" sx={{ minWidth: 100 }}>
                                                            <InputLabel>Impact</InputLabel>
                                                            <Select
                                                                value={editingRisk.impact}
                                                                label="Impact"
                                                                onChange={(e) => setEditingRisk({ ...editingRisk, impact: e.target.value as Schema['Risk']['type']['impact'] })}
                                                            >
                                                                <MenuItem value="LOW">Low</MenuItem>
                                                                <MenuItem value="MEDIUM">Medium</MenuItem>
                                                                <MenuItem value="HIGH">High</MenuItem>
                                                                <MenuItem value="CRITICAL">Critical</MenuItem>
                                                            </Select>
                                                        </FormControl>
                                                        <TextField
                                                            label="Prob (%)"
                                                            type="number"
                                                            size="small"
                                                            sx={{ width: 100 }}
                                                            value={editingRisk.probability}
                                                            onChange={(e) => setEditingRisk({ ...editingRisk, probability: parseInt(e.target.value) || 0 })}
                                                        />
                                                        <FormControl size="small" sx={{ minWidth: 120 }}>
                                                            <InputLabel>ROAM</InputLabel>
                                                            <Select
                                                                value={editingRisk.roamStatus}
                                                                label="ROAM"
                                                                onChange={(e) => setEditingRisk({ ...editingRisk, roamStatus: e.target.value as Schema['Risk']['type']['roamStatus'] })}
                                                            >
                                                                <MenuItem value="RESOLVED">Resolved</MenuItem>
                                                                <MenuItem value="OWNED">Owned</MenuItem>
                                                                <MenuItem value="ACCEPTED">Accepted</MenuItem>
                                                                <MenuItem value="MITIGATED">Mitigated</MenuItem>
                                                            </Select>
                                                        </FormControl>
                                                        <Box flexGrow={1} />
                                                        <IconButton size="small" color="primary" onClick={() => handleUpdateRisk(risk.id, { description: editingRisk.description, impact: editingRisk.impact, probability: editingRisk.probability, roamStatus: editingRisk.roamStatus })}>
                                                            <SaveIcon />
                                                        </IconButton>
                                                        <IconButton size="small" onClick={() => setEditingRisk(null)}>
                                                            <CloseIcon />
                                                        </IconButton>
                                                    </Stack>
                                                </Stack>
                                            ) : (
                                                <>
                                                    <Box>
                                                        <Typography variant="body2" fontWeight="500">{risk.description}</Typography>
                                                        <Stack direction="row" spacing={1} mt={0.5}>
                                                            <Chip label={`Impact: ${risk.impact}`} size="small" color={['HIGH', 'CRITICAL'].includes(risk.impact || '') ? 'error' : 'default'} variant="outlined" sx={{ height: 20, fontSize: '0.65rem' }} />
                                                            <Chip label={`Prob: ${risk.probability}%`} size="small" variant="outlined" sx={{ height: 20, fontSize: '0.65rem' }} />
                                                            <Chip label={`ROAM: ${risk.roamStatus}`} size="small" color={risk.roamStatus === 'RESOLVED' ? 'success' : risk.roamStatus === 'MITIGATED' ? 'info' : 'warning'} sx={{ height: 20, fontSize: '0.65rem' }} />
                                                        </Stack>
                                                    </Box>
                                                    <Stack direction="row">
                                                        <IconButton size="small" onClick={() => setEditingRisk({ ...risk })}>
                                                            <EditIcon fontSize="small" />
                                                        </IconButton>
                                                        <IconButton size="small" color="error" onClick={() => handleDeleteRisk(risk.id)}>
                                                            <DeleteIcon fontSize="small" />
                                                        </IconButton>
                                                    </Stack>
                                                </>
                                            )}
                                        </Box>
                                    );
                                })}
                            </Stack>
                        </Collapse>
                    </Paper>

                    {/* Dependencies Section */}
                    <Paper elevation={0} sx={{ mx: 3, mb: 3, border: 1, borderColor: 'divider', bgcolor: 'grey.50' }}>
                        <Box
                            px={2}
                            py={1}
                            display="flex"
                            justifyContent="space-between"
                            alignItems="center"
                            borderBottom={dependenciesExpanded ? 1 : 0}
                            borderColor="divider"
                            onClick={() => setDependenciesExpanded(!dependenciesExpanded)}
                            sx={{ cursor: 'pointer', '&:hover': { bgcolor: 'grey.100' } }}
                        >
                            <Typography variant="subtitle2" fontWeight="bold" color="text.secondary">DEPENDENCIES</Typography>
                            <Stack direction="row" spacing={1}>
                                <Button size="small" startIcon={<AddIcon />} onClick={(e) => { e.stopPropagation(); setIsCreatingDependency(true); setDependenciesExpanded(true); }}>
                                    Add
                                </Button>
                                <IconButton size="small" onClick={(e) => { e.stopPropagation(); setDependenciesExpanded(!dependenciesExpanded); }}>
                                    {dependenciesExpanded ? <ExpandLess /> : <ExpandMore />}
                                </IconButton>
                            </Stack>
                        </Box>
                        <Collapse in={dependenciesExpanded} timeout="auto" unmountOnExit>
                            <Stack spacing={0}>
                                {isCreatingDependency && (
                                    <Box p={1.5} borderBottom={1} borderColor="divider" bgcolor="white">
                                        <Typography variant="caption" color="text.secondary" fontWeight="bold" mb={1} display="block">NEW DEPENDENCY</Typography>
                                        <Stack spacing={1}>
                                            <TextField
                                                fullWidth
                                                size="small"
                                                value={newDependency.description}
                                                onChange={(e) => setNewDependency({ ...newDependency, description: e.target.value })}
                                                label="Description"
                                                autoFocus
                                            />
                                            <Box display="grid" gridTemplateColumns="repeat(2, 1fr)" gap={1}>
                                                <TextField value={newDependency.owner} onChange={(e) => setNewDependency({ ...newDependency, owner: e.target.value })} label="Owner" size="small" />
                                                <FormControl size="small">
                                                    <InputLabel>State</InputLabel>
                                                    <Select value={newDependency.state} label="State" onChange={(e) => setNewDependency({ ...newDependency, state: e.target.value })}>
                                                        <MenuItem value="ACTIVE">Active</MenuItem>
                                                        <MenuItem value="RESOLVED">Resolved</MenuItem>
                                                        <MenuItem value="PLANNED">Planned</MenuItem>
                                                        <MenuItem value="PAST_DUE">Past Due</MenuItem>
                                                    </Select>
                                                </FormControl>
                                                <FormControl size="small">
                                                    <InputLabel>Status</InputLabel>
                                                    <Select value={newDependency.status} label="Status" onChange={(e) => setNewDependency({ ...newDependency, status: e.target.value })}>
                                                        <MenuItem value="ON_TRACK">On Track</MenuItem>
                                                        <MenuItem value="AT_RISK">At Risk</MenuItem>
                                                        <MenuItem value="OFF_TRACK">Off Track</MenuItem>
                                                    </Select>
                                                </FormControl>
                                                <TextField type="date" value={newDependency.dueDate} onChange={(e) => setNewDependency({ ...newDependency, dueDate: e.target.value })} label="Due Date" size="small" InputLabelProps={{ shrink: true }} />
                                            </Box>
                                            <Stack direction="row" justifyContent="flex-end" spacing={1}>
                                                <Button size="small" variant="contained" onClick={handleCreateDependency} disabled={!newDependency.description}>
                                                    Save
                                                </Button>
                                                <Button size="small" onClick={() => setIsCreatingDependency(false)}>
                                                    Cancel
                                                </Button>
                                            </Stack>
                                        </Stack>
                                    </Box>
                                )}
                                {dependencies.length === 0 && !isCreatingDependency && (
                                    <Box p={2} textAlign="center">
                                        <Typography variant="body2" color="text.secondary" fontStyle="italic">No dependencies tracked. Click 'Add' to create one.</Typography>
                                    </Box>
                                )}
                                {dependencies.map((dep, index) => {
                                    const isEditing = editingDependency?.id === dep.id;
                                    return (
                                        <Box key={dep.id} p={1.5} display="flex" justifyContent="space-between" alignItems="center" borderBottom={index !== dependencies.length - 1 ? 1 : 0} borderColor="divider">
                                            {isEditing ? (
                                                <Stack spacing={1} width="100%">
                                                    <TextField
                                                        fullWidth
                                                        size="small"
                                                        value={editingDependency.description}
                                                        onChange={(e) => setEditingDependency({ ...editingDependency, description: e.target.value })}
                                                        label="Description"
                                                    />
                                                    <Box display="grid" gridTemplateColumns="repeat(2, 1fr)" gap={1}>
                                                        <TextField value={editingDependency.owner || ''} onChange={(e) => setEditingDependency({ ...editingDependency, owner: e.target.value })} label="Owner" size="small" />
                                                        <FormControl size="small">
                                                            <InputLabel>State</InputLabel>
                                                            <Select value={editingDependency.state || 'ACTIVE'} label="State" onChange={(e) => setEditingDependency({ ...editingDependency, state: e.target.value })}>
                                                                <MenuItem value="ACTIVE">Active</MenuItem>
                                                                <MenuItem value="RESOLVED">Resolved</MenuItem>
                                                                <MenuItem value="PLANNED">Planned</MenuItem>
                                                                <MenuItem value="PAST_DUE">Past Due</MenuItem>
                                                            </Select>
                                                        </FormControl>
                                                        <FormControl size="small">
                                                            <InputLabel>Status</InputLabel>
                                                            <Select value={editingDependency.status || 'ON_TRACK'} label="Status" onChange={(e) => setEditingDependency({ ...editingDependency, status: e.target.value })}>
                                                                <MenuItem value="ON_TRACK">On Track</MenuItem>
                                                                <MenuItem value="AT_RISK">At Risk</MenuItem>
                                                                <MenuItem value="OFF_TRACK">Off Track</MenuItem>
                                                            </Select>
                                                        </FormControl>
                                                        <TextField type="date" value={editingDependency.dueDate ? editingDependency.dueDate.split('T')[0] : ''} onChange={(e) => setEditingDependency({ ...editingDependency, dueDate: e.target.value })} label="Due Date" size="small" InputLabelProps={{ shrink: true }} />
                                                    </Box>
                                                    <Stack direction="row" justifyContent="flex-end" spacing={1}>
                                                        <IconButton size="small" color="primary" onClick={() => handleUpdateDependency(dep.id, { description: editingDependency.description, owner: editingDependency.owner, state: editingDependency.state, status: editingDependency.status, dueDate: editingDependency.dueDate })}>
                                                            <SaveIcon />
                                                        </IconButton>
                                                        <IconButton size="small" onClick={() => setEditingDependency(null)}>
                                                            <CloseIcon />
                                                        </IconButton>
                                                    </Stack>
                                                </Stack>
                                            ) : (
                                                <>
                                                    <Box>
                                                        <Typography variant="body2" fontWeight="500">{dep.description}</Typography>
                                                        <Stack direction="row" spacing={1} mt={0.5} flexWrap="wrap">
                                                            <Chip label={dep.state} size="small" color={dep.state === 'ACTIVE' ? 'primary' : 'default'} variant="outlined" sx={{ height: 20, fontSize: '0.65rem' }} />
                                                            <Chip label={dep.status} size="small" color={dep.status === 'ON_TRACK' ? 'success' : 'error'} variant="outlined" sx={{ height: 20, fontSize: '0.65rem' }} />
                                                            {dep.owner && <Chip label={`Owner: ${dep.owner}`} size="small" variant="outlined" sx={{ height: 20, fontSize: '0.65rem' }} />}
                                                            {dep.dueDate && <Chip label={`Due: ${new Date(dep.dueDate).toLocaleDateString()}`} size="small" variant="outlined" sx={{ height: 20, fontSize: '0.65rem' }} />}
                                                        </Stack>
                                                    </Box>
                                                    <Stack direction="row">
                                                        <IconButton size="small" onClick={() => setEditingDependency({ ...dep })}>
                                                            <EditIcon fontSize="small" />
                                                        </IconButton>
                                                        <IconButton size="small" color="error" onClick={() => handleDeleteDependency(dep.id)}>
                                                            <DeleteIcon fontSize="small" />
                                                        </IconButton>
                                                    </Stack>
                                                </>
                                            )}
                                        </Box>
                                    );
                                })}
                            </Stack>
                        </Collapse>
                    </Paper>

                    {loading ? (
                        <Box display="flex" justifyContent="center" alignItems="center" height="200px">
                            <CircularProgress />
                        </Box>
                    ) : (
                        <Box p={3}>
                            <Box
                                display="flex"
                                justifyContent="space-between"
                                alignItems="center"
                                mb={2}
                                onClick={() => setOutcomesExpanded(!outcomesExpanded)}
                                sx={{ cursor: 'pointer', '&:hover': { bgcolor: 'grey.50' }, borderRadius: 1, p: 1 }}
                            >
                                <Stack direction="row" alignItems="center" spacing={1}>
                                    <IconButton size="small" onClick={(e) => { e.stopPropagation(); setOutcomesExpanded(!outcomesExpanded); }}>
                                        {outcomesExpanded ? <ExpandLess /> : <ExpandMore />}
                                    </IconButton>
                                    <Typography variant="h6" color="text.secondary" sx={{ textTransform: 'uppercase', fontSize: '0.875rem', fontWeight: 700, letterSpacing: 1 }}>
                                        Outcomes
                                    </Typography>
                                </Stack>
                                <Button
                                    startIcon={<AddIcon />}
                                    size="small"
                                    variant="outlined"
                                    onClick={(e) => { e.stopPropagation(); openDialog('create', 'outcome'); }}
                                >
                                    Add Outcome
                                </Button>
                            </Box>

                            <Collapse in={outcomesExpanded} timeout="auto" unmountOnExit>
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
                                                            {outcome.keyResults.map((kr) => (
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
                                                                        <Tooltip title="Log Heartbeat">
                                                                            <IconButton size="small" sx={{ p: 0.5 }} color="primary" onClick={() => openHeartbeatWizard('kr', kr)}>
                                                                                <MonitorHeartIcon sx={{ fontSize: 14 }} />
                                                                            </IconButton>
                                                                        </Tooltip>
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
                                                                                {kr.initiatives.map((init) => (
                                                                                    <Paper key={init.id} elevation={0} sx={{ p: 1, bgcolor: 'grey.50', border: 1, borderColor: 'divider' }}>
                                                                                        <Stack direction="row" alignItems="center" spacing={1}>
                                                                                            <Typography variant="caption" fontWeight="bold" color="secondary.main">INIT</Typography>
                                                                                            <Typography variant="body2">{init.title}</Typography>
                                                                                            {init.projectLink && (
                                                                                                <Tooltip title="Open Project Plan">
                                                                                                    <IconButton
                                                                                                        size="small"
                                                                                                        component="a"
                                                                                                        href={init.projectLink}
                                                                                                        target="_blank"
                                                                                                        onClick={(e) => e.stopPropagation()}
                                                                                                        sx={{ p: 0.2, ml: 0.5, color: 'primary.main' }}
                                                                                                    >
                                                                                                        <LinkIcon sx={{ fontSize: 16 }} />
                                                                                                    </IconButton>
                                                                                                </Tooltip>
                                                                                            )}
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
                            </Collapse>
                        </Box>
                    )}
                </DialogContent>
            </Dialog >

            {/* Item Dialog (Create/Edit) */}
            < Dialog
                open={dialogState.open}
                onClose={() => setDialogState({ ...dialogState, open: false })
                }
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
                        {/* Project Link for Initiative */}
                        {dialogState.type === 'initiative' && (
                            <TextField
                                label="Project Link (JIRA, Asana, etc.)"
                                fullWidth
                                variant="outlined"
                                value={itemProjectLink}
                                onChange={(e) => setItemProjectLink(e.target.value)}
                                placeholder="https://..."
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
                        {/* KR Metric Name & Unit */}
                        {dialogState.type === 'kr' && (
                            <Stack direction="row" spacing={2}>
                                <Autocomplete
                                    freeSolo
                                    fullWidth
                                    options={METRIC_OPTIONS}
                                    groupBy={(option) => {
                                        if (!option || typeof option !== 'object') return 'Custom';
                                        return (option as { group: string }).group || 'Other';
                                    }}
                                    getOptionLabel={(option) => {
                                        if (typeof option === 'string') return option;
                                        // Safety check for option object
                                        if (option && typeof option === 'object' && 'label' in option) return (option as { label: string }).label;
                                        return '';
                                    }}
                                    // Control inputValue directly for free text
                                    inputValue={itemMetricName || ''}
                                    onInputChange={(_, newInputValue) => setItemMetricName(newInputValue || '')}
                                    // Ensure value is handled if selected
                                    onChange={(_, newValue) => {
                                        if (typeof newValue === 'string') {
                                            setItemMetricName(newValue);
                                        } else if (newValue && typeof newValue === 'object') {
                                            setItemMetricName((newValue as { label: string }).label);
                                        }
                                    }}
                                    renderInput={(params) => (
                                        <TextField
                                            {...params}
                                            label="Metric Name (Optional)"
                                            variant="outlined"
                                            placeholder="Select or type..."
                                        />
                                    )}
                                />
                                <Autocomplete
                                    freeSolo
                                    options={['%', '$', '#', 'items', 'hours', 'days']}
                                    inputValue={itemMetricUnit || ''}
                                    onInputChange={(_, newInputValue) => setItemMetricUnit(newInputValue || '')}
                                    renderInput={(params) => (
                                        <TextField
                                            {...params}
                                            label="Unit"
                                            variant="outlined"
                                        />
                                    )}
                                    sx={{ width: '180px', flexShrink: 0 }}
                                />
                            </Stack>
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
                                        {m.profile?.preferredName || m.profile?.email || m.inviteEmail || 'Unknown Member'}
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
            </Dialog >

            {
                heartbeatState.item && (
                    <HeartbeatWizard
                        open={heartbeatState.open}
                        onClose={() => setHeartbeatState({ ...heartbeatState, open: false })}
                        item={heartbeatState.item}
                        itemType={heartbeatState.type}
                        onComplete={refreshTree}
                    />
                )
            }

            {
                historyState.item && (
                    <HeartbeatHistoryDialog
                        open={historyState.open}
                        onClose={() => setHistoryState({ ...historyState, open: false })}
                        item={historyState.item}
                        itemType={historyState.type}
                    />
                )
            }

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
