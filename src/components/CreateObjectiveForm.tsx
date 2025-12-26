import { useState } from 'react';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../amplify/data/resource';
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
    Stack
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';

const client = generateClient<Schema>();

interface Props {
    organizationId: string;
    onClose: () => void;
    onSuccess: (newObjective: Schema['StrategicObjective']['type']) => void;
}

interface NewInitiative {
    title: string;
    description: string;
}

interface NewKeyResult {
    statement: string;
    initiatives: NewInitiative[];
}

interface NewOutcome {
    title: string;
    description: string;
    keyResults: NewKeyResult[];
}

export function CreateObjectiveForm({ organizationId, onClose, onSuccess }: Props) {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [outcomes, setOutcomes] = useState<NewOutcome[]>([]);
    const [loading, setLoading] = useState(false);

    const addOutcome = () => {
        setOutcomes([...outcomes, { title: '', description: '', keyResults: [] }]);
    };

    const updateOutcome = (index: number, field: keyof NewOutcome, value: string) => {
        const newOutcomes = [...outcomes];
        (newOutcomes[index] as any)[field] = value;
        setOutcomes(newOutcomes);
    };

    const removeOutcome = (index: number) => {
        const newOutcomes = [...outcomes];
        newOutcomes.splice(index, 1);
        setOutcomes(newOutcomes);
    }

    const addKeyResult = (outcomeIndex: number) => {
        const newOutcomes = [...outcomes];
        newOutcomes[outcomeIndex].keyResults.push({ statement: '', initiatives: [] });
        setOutcomes(newOutcomes);
    };

    const updateKeyResult = (outcomeIndex: number, krIndex: number, value: string) => {
        const newOutcomes = [...outcomes];
        newOutcomes[outcomeIndex].keyResults[krIndex].statement = value;
        setOutcomes(newOutcomes);
    };

    const removeKeyResult = (outcomeIndex: number, krIndex: number) => {
        const newOutcomes = [...outcomes];
        newOutcomes[outcomeIndex].keyResults.splice(krIndex, 1);
        setOutcomes(newOutcomes);
    }

    const addInitiative = (outcomeIndex: number, krIndex: number) => {
        const newOutcomes = [...outcomes];
        newOutcomes[outcomeIndex].keyResults[krIndex].initiatives.push({ title: '', description: '' });
        setOutcomes(newOutcomes);
    };

    const updateInitiative = (outcomeIndex: number, krIndex: number, initIndex: number, field: keyof NewInitiative, value: string) => {
        const newOutcomes = [...outcomes];
        (newOutcomes[outcomeIndex].keyResults[krIndex].initiatives[initIndex] as any)[field] = value;
        setOutcomes(newOutcomes);
    };

    const removeInitiative = (outcomeIndex: number, krIndex: number, initIndex: number) => {
        const newOutcomes = [...outcomes];
        newOutcomes[outcomeIndex].keyResults[krIndex].initiatives.splice(initIndex, 1);
        setOutcomes(newOutcomes);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            // 1. Create Objective
            const { data: obj, errors: objErrors } = await client.models.StrategicObjective.create({
                organizationId,
                title,
                description,
                status: 'active'
            });
            if (objErrors) throw new Error(objErrors[0].message);
            if (!obj) throw new Error('Failed to create objective');

            // 2. Create nested entities
            for (const outcomeData of outcomes) {
                const { data: outcome, errors: outErrors } = await client.models.Outcome.create({
                    organizationId,
                    strategicObjectiveId: obj.id,
                    title: outcomeData.title,
                    description: outcomeData.description,
                    status: 'active'
                });
                if (outErrors) console.error("Outcome creation error", outErrors);

                if (outcome) {
                    for (const krData of outcomeData.keyResults) {
                        const { data: kr, errors: krErrors } = await client.models.KeyResult.create({
                            organizationId,
                            strategicObjectiveId: obj.id,
                            outcomeId: outcome.id,
                            statement: krData.statement,
                            status: 'active'
                        });
                        if (krErrors) console.error("KR creation error", krErrors);

                        if (kr) {
                            for (const initData of krData.initiatives) {
                                const { errors: initErrors } = await client.models.Initiative.create({
                                    organizationId,
                                    title: initData.title,
                                    description: initData.description,
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

                    <Box>
                        <Typography variant="subtitle2" color="text.secondary" gutterBottom>OBJECTIVE DETAILS</Typography>
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
                                    <TextField
                                        label={`Outcome #${oIdx + 1}`}
                                        fullWidth
                                        size="small"
                                        value={outcome.title}
                                        onChange={e => updateOutcome(oIdx, 'title', e.target.value)}
                                        placeholder="Desited Business Outcome"
                                        required
                                    />
                                </Box>

                                {/* Key Results */}
                                <Box sx={{ pl: 2, borderLeft: '2px solid', borderColor: 'primary.light' }}>
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                                        <Typography variant="caption" fontWeight="bold" color="primary">KEY RESULTS</Typography>
                                        <Button size="small" startIcon={<AddIcon />} onClick={() => addKeyResult(oIdx)}>Add KR</Button>
                                    </Box>

                                    {outcome.keyResults.map((kr, kIdx) => (
                                        <Box key={kIdx} mb={2}>
                                            <Stack direction="row" spacing={1} alignItems="center">
                                                <TextField
                                                    fullWidth
                                                    size="small"
                                                    placeholder="Key Result Statement"
                                                    value={kr.statement}
                                                    onChange={e => updateKeyResult(oIdx, kIdx, e.target.value)}
                                                />
                                                <IconButton size="small" onClick={() => removeKeyResult(oIdx, kIdx)}><DeleteIcon fontSize="small" /></IconButton>
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
