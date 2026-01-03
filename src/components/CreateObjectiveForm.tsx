import { useState, useEffect } from 'react';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../amplify/data/resource';
import { SUBSCRIPTION_LIMITS, type SubscriptionTier } from '../utils/subscriptionLimits';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    TextField,
    Box,
    Typography,
    Divider,
    IconButton,
    Paper,
    Stack,
    Alert,
    MenuItem,
    Select,
    FormControl,
    InputLabel,
    Autocomplete
} from '@mui/material';
import { COMMON_METRICS } from '../utils/commonMetrics';
import CloseIcon from '@mui/icons-material/Close';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';

const client = generateClient<Schema>();

interface Props {
    organizationId: string;
    onClose: () => void;
    onSuccess: (newObjective: Schema['StrategicObjective']['type']) => void;
    userProfile: Schema['UserProfile']['type'];
}

interface NewInitiative {
    title: string;
    description: string;
    ownerId?: string;
}

interface NewKeyResult {
    statement: string;
    initiatives: NewInitiative[];
    ownerId?: string;
    metricName?: string;
}

interface NewOutcome {
    title: string;
    description: string;
    keyResults: NewKeyResult[];
    ownerId?: string;
}

interface TeamMember {
    id: string;
    displayName: string;
}

export function CreateObjectiveForm({ organizationId, onClose, onSuccess, userProfile }: Props) {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [ownerId, setOwnerId] = useState<string>(userProfile.id);
    const [outcomes, setOutcomes] = useState<NewOutcome[]>([]);
    const [loading, setLoading] = useState(false);
    const [existingObjCount, setExistingObjCount] = useState<number | null>(null);
    const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);

    const currentTier = (userProfile.tier as SubscriptionTier) || 'FREE';
    const limits = SUBSCRIPTION_LIMITS[currentTier];

    useEffect(() => {
        // Fetch objective count
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (client.models.StrategicObjective as any).list({
            filter: { organizationId: { eq: organizationId } }
        }).then(({ data }: { data: { length: number }[] }) => setExistingObjCount(data.length));

        // Fetch team members
        const fetchTeam = async () => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { data: memberships } = await (client.models.Membership as any).list({
                filter: { organizationId: { eq: organizationId } }
            });
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const loadedMembers = await Promise.all(memberships.map(async (m: any) => {
                const { data: user } = await m.user();
                return {
                    id: user?.id || 'unknown',
                    displayName: user?.preferredName || user?.email || 'Unknown User'
                };
            }));
            setTeamMembers(loadedMembers.filter(m => m.id !== 'unknown'));
        };
        fetchTeam();

    }, [organizationId]);

    const addOutcome = () => {
        if (outcomes.length >= limits.maxOutcomesPerObjective) {
            if (!confirm(`You have reached the recommended limit of ${limits.maxOutcomesPerObjective} Outcomes per Objective. Continue?`)) return;
        }
        setOutcomes([...outcomes, { title: '', description: '', keyResults: [], ownerId: userProfile.id }]);
    };

    const updateOutcome = (index: number, field: keyof NewOutcome, value: string) => {
        const newOutcomes = [...outcomes];
        newOutcomes[index] = { ...newOutcomes[index], [field]: value };
        setOutcomes(newOutcomes);
    };

    const removeOutcome = (index: number) => {
        const newOutcomes = [...outcomes];
        newOutcomes.splice(index, 1);
        setOutcomes(newOutcomes);
    }

    const addKeyResult = (outcomeIndex: number) => {
        const newOutcomes = [...outcomes];
        const currentKRs = [...newOutcomes[outcomeIndex].keyResults];

        if (currentKRs.length >= limits.maxKeyResultsPerOutcome) {
            if (!confirm(`You have reached the recommended limit of ${limits.maxKeyResultsPerOutcome} Key Results per Outcome. Continue?`)) return;
        }
        currentKRs.push({ statement: '', initiatives: [], ownerId: userProfile.id, metricName: '' });
        newOutcomes[outcomeIndex] = { ...newOutcomes[outcomeIndex], keyResults: currentKRs };
        setOutcomes(newOutcomes);
    };

    const updateKeyResult = (outcomeIndex: number, krIndex: number, field: keyof NewKeyResult, value: string) => {
        const newOutcomes = [...outcomes];
        const currentKRs = [...newOutcomes[outcomeIndex].keyResults];
        currentKRs[krIndex] = { ...currentKRs[krIndex], [field]: value };
        newOutcomes[outcomeIndex] = { ...newOutcomes[outcomeIndex], keyResults: currentKRs };
        setOutcomes(newOutcomes);
    };

    const removeKeyResult = (outcomeIndex: number, krIndex: number) => {
        const newOutcomes = [...outcomes];
        const currentKRs = [...newOutcomes[outcomeIndex].keyResults];
        currentKRs.splice(krIndex, 1);
        newOutcomes[outcomeIndex] = { ...newOutcomes[outcomeIndex], keyResults: currentKRs };
        setOutcomes(newOutcomes);
    }

    const addInitiative = (outcomeIndex: number, krIndex: number) => {
        const newOutcomes = [...outcomes];
        const currentKRs = [...newOutcomes[outcomeIndex].keyResults];
        const currentInits = [...currentKRs[krIndex].initiatives];

        if (currentInits.length >= limits.maxInitiativesPerKeyResult) {
            if (!confirm(`You have reached the recommended limit of ${limits.maxInitiativesPerKeyResult} Initiatives per Key Result. Continue?`)) return;
        }
        currentInits.push({ title: '', description: '', ownerId: userProfile.id });
        currentKRs[krIndex] = { ...currentKRs[krIndex], initiatives: currentInits };
        newOutcomes[outcomeIndex] = { ...newOutcomes[outcomeIndex], keyResults: currentKRs };
        setOutcomes(newOutcomes);
    };

    const updateInitiative = (outcomeIndex: number, krIndex: number, initIndex: number, field: keyof NewInitiative, value: string) => {
        const newOutcomes = [...outcomes];
        const currentKRs = [...newOutcomes[outcomeIndex].keyResults];
        const currentInits = [...currentKRs[krIndex].initiatives];

        currentInits[initIndex] = { ...currentInits[initIndex], [field]: value };
        currentKRs[krIndex] = { ...currentKRs[krIndex], initiatives: currentInits };
        newOutcomes[outcomeIndex] = { ...newOutcomes[outcomeIndex], keyResults: currentKRs };
        setOutcomes(newOutcomes);
    };

    const removeInitiative = (outcomeIndex: number, krIndex: number, initIndex: number) => {
        const newOutcomes = [...outcomes];
        newOutcomes[outcomeIndex].keyResults[krIndex].initiatives.splice(initIndex, 1);
        setOutcomes(newOutcomes);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (existingObjCount !== null && existingObjCount >= limits.maxObjectives) {
            if (!confirm(`Organization limit of ${limits.maxObjectives} Objectives reached. Create anyway (soft limit)?`)) return;
        }

        const getOwnerObj = (id?: string) => {
            if (!id) return null;
            const member = teamMembers.find(m => m.id === id);
            return member ? { userId: member.id, displayName: member.displayName, role: 'OWNER' } : null;
        };

        const getMetricObj = (metricName?: string) => {
            if (!metricName) return null;
            const m = COMMON_METRICS.find(cm => cm.name === metricName);
            if (!m) return null;
            return {
                name: m.name,
                unit: m.unit,
                direction: 'HIGHER_BETTER', // Default, could be refined
            };
        };

        setLoading(true);
        try {
            // 1. Create Objective
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { data: obj, errors: objErrors } = await (client.models.StrategicObjective as any).create({
                organizationId,
                title,
                description,
                status: 'active',
                owner: getOwnerObj(ownerId)
            });
            if (objErrors) throw new Error(objErrors[0].message);
            if (!obj) throw new Error('Failed to create objective');

            // 2. Create nested entities
            for (const outcomeData of outcomes) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const { data: outcome, errors: outErrors } = await (client.models.Outcome as any).create({
                    organizationId,
                    strategicObjectiveId: obj.id,
                    title: outcomeData.title,
                    description: outcomeData.description,
                    status: 'active',
                    owner: getOwnerObj(outcomeData.ownerId)
                });
                if (outErrors) console.error("Outcome creation error", outErrors);

                if (outcome) {
                    for (const krData of outcomeData.keyResults) {
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        const { data: kr, errors: krErrors } = await (client.models.KeyResult as any).create({
                            organizationId,
                            strategicObjectiveId: obj.id,
                            outcomeId: outcome.id,
                            statement: krData.statement,
                            status: 'active',
                            owners: krData.ownerId ? [getOwnerObj(krData.ownerId)!] : [], // Key Result has `owners` array
                            metric: getMetricObj(krData.metricName)
                        });
                        if (krErrors) console.error("KR creation error", krErrors);

                        if (kr) {
                            for (const initData of krData.initiatives) {
                                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                const { errors: initErrors } = await (client.models.Initiative as any).create({
                                    organizationId,
                                    title: initData.title,
                                    description: initData.description,
                                    owner: getOwnerObj(initData.ownerId),
                                    linkedEntities: {
                                        strategicObjectiveIds: [obj.id],
                                        outcomeIds: [outcome.id],
                                        keyResultIds: [kr.id]
                                    }
                                });
                                if (initErrors) console.error("Initiative creation error", initErrors);
                            }
                        }
                    }
                }
            }

            onSuccess(obj);
            onClose();
        } catch (e) {
            console.error(e);
            alert('Error creating objective structure');
        } finally {
            setLoading(false);
        }
    };

    const OwnerSelect = ({ value, onChange, label, size = 'small' }: { value?: string, onChange: (val: string) => void, label?: string, size?: 'small' | 'medium' }) => (
        <FormControl fullWidth size={size}>
            <InputLabel>{label || "Owner"}</InputLabel>
            <Select
                value={value || ''}
                label={label || "Owner"}
                onChange={(e) => onChange(e.target.value)}
            >
                {teamMembers.map((member) => (
                    <MenuItem key={member.id} value={member.id}>
                        {member.displayName}
                    </MenuItem>
                ))}
            </Select>
        </FormControl>
    );

    return (
        <Dialog
            open={true}
            onClose={onClose}
            maxWidth="md"
            fullWidth
            PaperProps={{ sx: { minHeight: '80vh' } }}
        >
            <DialogTitle sx={{ m: 0, p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Typography variant="h6" fontWeight="bold">Create Strategic Objective</Typography>
                <IconButton onClick={onClose} aria-label="close">
                    <CloseIcon />
                </IconButton>
            </DialogTitle>
            <Divider />

            <DialogContent dividers>
                <Box component="form" id="create-objective-form" onSubmit={handleSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>

                    {existingObjCount !== null && existingObjCount >= limits.maxObjectives && (
                        <Alert severity="warning">
                            Warning: Organization has reached the recommended limit of {limits.maxObjectives} strategic objectives.
                        </Alert>
                    )}

                    <Box>
                        <Typography variant="subtitle2" color="text.secondary" gutterBottom>OBJECTIVE DETAILS</Typography>
                        <Stack direction="row" spacing={2} mb={2}>
                            <TextField
                                autoFocus
                                margin="dense"
                                id="title"
                                label="Objective Title"
                                placeholder="e.g. Expand Market Share globally"
                                type="text"
                                fullWidth
                                variant="outlined"
                                value={title}
                                onChange={e => setTitle(e.target.value)}
                                required
                            />
                            <Box minWidth={200}>
                                <OwnerSelect value={ownerId} onChange={setOwnerId} size="medium" />
                            </Box>
                        </Stack>

                        <TextField
                            margin="normal"
                            id="description"
                            label="Description"
                            placeholder="Why is this important now?"
                            type="text"
                            fullWidth
                            multiline
                            rows={3}
                            variant="outlined"
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                        />
                    </Box>

                    <Divider />

                    <Box>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                            <Typography variant="subtitle2" color="text.secondary">OUTCOMES & KEY RESULTS</Typography>
                            <Button startIcon={<AddIcon />} variant="outlined" size="small" onClick={addOutcome}>
                                Add Outcome
                            </Button>
                        </Box>

                        {outcomes.length === 0 && (
                            <Paper variant="outlined" sx={{ p: 4, textAlign: 'center', bgcolor: 'grey.50', borderStyle: 'dashed' }}>
                                <Typography color="text.secondary">No Outcomes defined yet. Click "Add Outcome" to build your strategy tree.</Typography>
                            </Paper>
                        )}

                        {outcomes.map((outcome, oIdx) => (
                            <Paper key={oIdx} variant="outlined" sx={{ p: 2, mb: 3, position: 'relative' }}>
                                <IconButton
                                    size="small"
                                    onClick={() => removeOutcome(oIdx)}
                                    sx={{ position: 'absolute', top: 8, right: 8, color: 'text.secondary' }}
                                >
                                    <DeleteIcon fontSize="small" />
                                </IconButton>

                                <Box mb={2}>
                                    <Stack direction="row" spacing={2}>
                                        <TextField
                                            label={`Outcome #${oIdx + 1}`}
                                            fullWidth
                                            size="small"
                                            value={outcome.title}
                                            onChange={e => updateOutcome(oIdx, 'title', e.target.value)}
                                            placeholder="Desited Business Outcome"
                                            required
                                        />
                                        <Box minWidth={180}>
                                            <OwnerSelect
                                                value={outcome.ownerId}
                                                onChange={(val) => updateOutcome(oIdx, 'ownerId', val)}
                                            />
                                        </Box>
                                    </Stack>
                                </Box>

                                {/* Key Results */}
                                <Box sx={{ pl: 2, borderLeft: '2px solid', borderColor: 'primary.light' }}>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                                        <Typography variant="caption" fontWeight="bold" color="primary">KEY RESULTS</Typography>
                                        <Button size="small" startIcon={<AddIcon />} onClick={() => addKeyResult(oIdx)}>Add KR</Button>
                                    </Box>

                                    {outcome.keyResults.map((kr, kIdx) => (
                                        <Box key={kIdx} mb={2}>
                                            <Stack direction="column" spacing={2} sx={{ mb: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                                                <Stack direction="row" spacing={1} alignItems="center">
                                                    <TextField
                                                        fullWidth
                                                        size="small"
                                                        placeholder="Key Result Statement"
                                                        value={kr.statement}
                                                        onChange={e => updateKeyResult(oIdx, kIdx, 'statement', e.target.value)}
                                                    />
                                                    <Box minWidth={150}>
                                                        <OwnerSelect
                                                            value={kr.ownerId}
                                                            onChange={(val) => updateKeyResult(oIdx, kIdx, 'ownerId', val)}
                                                        />
                                                    </Box>
                                                    <IconButton size="small" onClick={() => removeKeyResult(oIdx, kIdx)}><DeleteIcon fontSize="small" /></IconButton>
                                                </Stack>

                                                <Autocomplete
                                                    fullWidth
                                                    size="small"
                                                    options={COMMON_METRICS}
                                                    groupBy={(option) => option.category}
                                                    getOptionLabel={(option) => option.name}
                                                    value={COMMON_METRICS.find(m => m.name === kr.metricName) || null}
                                                    onChange={(_, newValue) => {
                                                        updateKeyResult(oIdx, kIdx, 'metricName', newValue?.name || '')
                                                    }}
                                                    renderInput={(params) => (
                                                        <TextField {...params} label="Standard Metric (Optional)" placeholder="Select a standard metric to track" />
                                                    )}
                                                />
                                            </Stack>

                                            {/* Initiatives */}
                                            <Box sx={{ pl: 3, mt: 1 }}>
                                                {kr.initiatives.map((init, iIdx) => (
                                                    <Stack key={iIdx} direction="row" spacing={1} alignItems="center" mt={1}>
                                                        <Typography variant="caption" sx={{ minWidth: 60 }}>INITIATIVE</Typography>
                                                        <TextField
                                                            fullWidth
                                                            size="small"
                                                            placeholder="Initiative Title"
                                                            value={init.title}
                                                            onChange={e => updateInitiative(oIdx, kIdx, iIdx, 'title', e.target.value)}
                                                            sx={{ '& .MuiInputBase-input': { fontSize: '0.875rem', py: 0.5 } }}
                                                        />
                                                        <Box minWidth={140}>
                                                            <OwnerSelect
                                                                value={init.ownerId}
                                                                onChange={(val) => updateInitiative(oIdx, kIdx, iIdx, 'ownerId', val)}
                                                            />
                                                        </Box>
                                                        <IconButton size="small" onClick={() => removeInitiative(oIdx, kIdx, iIdx)}><DeleteIcon fontSize="small" /></IconButton>
                                                    </Stack>
                                                ))}
                                                <Button
                                                    size="small"
                                                    sx={{ mt: 1, fontSize: '0.7rem' }}
                                                    startIcon={<AddIcon fontSize="small" />}
                                                    onClick={() => addInitiative(oIdx, kIdx)}
                                                >
                                                    Add Initiative
                                                </Button>
                                            </Box>
                                        </Box>
                                    ))}
                                </Box>
                            </Paper>
                        ))}
                    </Box>

                </Box>
            </DialogContent>

            <DialogActions sx={{ p: 2 }}>
                <Button onClick={onClose} color="inherit">Cancel</Button>
                <Button
                    onClick={handleSubmit} // Trigger form submit 
                    variant="contained"
                    disabled={loading}
                    disableElevation
                >
                    {loading ? 'Creating...' : 'Create Strategic Objective & Tree'}
                </Button>
            </DialogActions>
        </Dialog>
    );
}
