import { useState } from 'react';
import {
    Dialog, DialogTitle, DialogContent, DialogActions,
    Button, Typography, Box, TextField, Stack,
    IconButton,
    List, ListItem, ListItemText, Chip, Step, Stepper, StepLabel,
    Slider, Select, MenuItem, FormControl, InputLabel
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import DeleteIcon from '@mui/icons-material/Delete';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../amplify/data/resource';

const client = generateClient<Schema>();
import { assessHeartbeat, generateKeyResultRollup } from '../utils/heartbeatLogic';

interface HeartbeatWizardProps {
    open: boolean;
    onClose: () => void;
    item: any;
    itemType: 'initiative' | 'outcome' | 'objective' | 'kr';
    onComplete: () => void;
    editHeartbeatId?: string;
    initialData?: any; // For edit mode
}

const steps = ['Context', 'Progress', 'Risks & Dependencies', 'Confidence', 'Review'];

export default function HeartbeatWizard({ open, onClose, item, itemType, onComplete, editHeartbeatId, initialData }: HeartbeatWizardProps) {
    const [activeStep, setActiveStep] = useState(0);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Derived State for KR
    const [derivedKR, setDerivedKR] = useState<any>(null);

    // Form State
    // Form State
    const [progressSummary, setProgressSummary] = useState('');
    const [risks, setRisks] = useState<{ description: string, impact: string, probability: number }[]>([]);
    const [newRiskDesc, setNewRiskDesc] = useState('');
    const [newRiskImpact, setNewRiskImpact] = useState('Medium');
    const [newRiskProb, setNewRiskProb] = useState<number>(50);

    const [dependencies, setDependencies] = useState<{ description: string, status: string }[]>([]);
    const [newDepDesc, setNewDepDesc] = useState('');

    const [ownerConfidence, setOwnerConfidence] = useState<number>(50);
    const [confidenceRationale, setConfidenceRationale] = useState('');

    // Pre-populate for Edit Mode
    useState(() => {
        if (editHeartbeatId && initialData) {
            const input = initialData.ownerInput;
            if (input) {
                setProgressSummary(input.progressSummary || '');
                setConfidenceRationale(input.confidenceRationale || '');
                setOwnerConfidence(input.ownerConfidence !== undefined ? input.ownerConfidence : 50);

                if (input.newRisks) {
                    setRisks(input.newRisks.map((r: any) => ({
                        description: r.description,
                        impact: r.impact,
                        probability: r.probability || 50
                    })));
                }
                if (input.dependencies) {
                    setDependencies(input.dependencies.map((d: any) => ({
                        description: d.description,
                        status: d.status
                    })));
                }
            }
        }
    });


    // Calculate KR Rollup on mount
    useState(() => {
        if (itemType === 'kr' && item.initiatives) {
            const initiatives = item.initiatives.map((i: any) => ({
                confidence: i.latestHeartbeat?.systemAssessment?.systemConfidence || i.latestHeartbeat?.ownerInput?.ownerConfidence || 'MEDIUM',
                title: i.title
            }));
            setDerivedKR(generateKeyResultRollup(initiatives));
        }
    });

    const handleNext = () => {
        if (itemType === 'kr' || activeStep === steps.length - 1) {
            handleSubmit();
        } else {
            setActiveStep((prev) => prev + 1);
        }
    };

    const handleBack = () => {
        setActiveStep((prev) => prev - 1);
    };


    // Calculate KR Rollup on mount
    useState(() => {
        if (itemType === 'kr' && item.initiatives) {
            const initiatives = item.initiatives.map((i: any) => ({
                confidence: i.latestHeartbeat?.systemAssessment?.systemConfidence || i.latestHeartbeat?.ownerInput?.ownerConfidence || 'MEDIUM',
                title: i.title
            }));
            setDerivedKR(generateKeyResultRollup(initiatives));
        }
    });

    const addRisk = () => {
        if (!newRiskDesc.trim()) return;
        setRisks([...risks, { description: newRiskDesc, impact: newRiskImpact, probability: newRiskProb }]);
        setNewRiskDesc('');
        setNewRiskImpact('Medium');
        setNewRiskProb(50);
    };

    const addDependency = () => {
        if (!newDepDesc.trim()) return;
        setDependencies([...dependencies, { description: newDepDesc, status: 'Active' }]);
        setNewDepDesc('');
    };


    const handleSubmit = async () => {
        setIsSubmitting(true);
        try {
            const now = new Date().toISOString();
            let heartbeatPayload: any = {};
            let systemAssessment: any = {};
            let ownerInput: any = {};

            if (itemType === 'kr') {
                // KR Derived Heartbeat
                if (!derivedKR) throw new Error("Rollup calculation failed");

                systemAssessment = {
                    systemConfidence: derivedKR.confidence,
                    confidenceTrend: derivedKR.trend,
                    integritySignals: {
                        updateFreshness: 'ON_TIME', // Assumed for rollup
                        languageSpecificity: 'SPECIFIC',
                        signalConsistency: 'ALIGNED'
                    },
                    uncertaintyFlags: [],
                    factsInferencesRecommendations: {
                        facts: [`Rolled up from ${item.initiatives?.length || 0} initiatives.`],
                        inferences: [],
                        recommendations: []
                    }
                };

                heartbeatPayload = {
                    type: 'SCHEDULED', // Event triggered?
                    status: 'COMPLETED',
                    timestamp: now,
                    keyResultId: item.id,
                    systemAssessment: systemAssessment,
                    // No purely human OwnerInput for KR, but we can store the summary
                    ownerInput: {
                        progressSummary: derivedKR.summary,
                        ownerConfidence: derivedKR.confidence,
                        confidenceRationale: "System Derived Rollup",
                    }
                };

            } else {
                // Standard Initiative/Outcome Heartbeat Logic
                ownerInput = {
                    progressSummary,
                    ownerConfidence: ownerConfidence || 'MEDIUM',
                    confidenceRationale,
                    newRisks: risks.map(r => ({
                        id: crypto.randomUUID(),
                        description: r.description,
                        impact: r.impact,
                        probability: r.probability
                    })),
                    dependencies: dependencies.map(d => ({
                        id: crypto.randomUUID(),
                        description: d.description,
                        status: d.status,
                        owner: 'External'
                    })),
                    milestoneStatus: 'On Track'
                };

                // Calculate System Assessment
                systemAssessment = assessHeartbeat(
                    ownerInput as any,
                    item.latestHeartbeat,
                    item.nextHeartbeatDue
                );

                if (editHeartbeatId) {
                    // UPDATE Logic
                    await client.models.Heartbeat.update({
                        id: editHeartbeatId,
                        ownerInput: ownerInput,
                        systemAssessment: systemAssessment
                    });
                    // Skip Next Due Date logic on edit for now or handle complexity?
                    // Usually edit is just content fix.
                    onComplete();
                    onClose();
                    return;
                }

                heartbeatPayload = {
                    type: 'SCHEDULED',
                    status: 'COMPLETED',
                    timestamp: now,
                    ownerInput: ownerInput,
                    systemAssessment: systemAssessment
                };

                if (itemType === 'initiative') heartbeatPayload.initiativeId = item.id;
                else if (itemType === 'outcome') heartbeatPayload.outcomeId = item.id;
                else if (itemType === 'objective') heartbeatPayload.strategicObjectiveId = item.id;
            }

            const newHeartbeat = await client.models.Heartbeat.create(heartbeatPayload);

            // 2. Update Parent Latest Heartbeat
            const latestHeartbeat = {
                heartbeatId: newHeartbeat.data?.id || crypto.randomUUID(),
                timestamp: now,
                ownerInput: itemType === 'kr' ? heartbeatPayload.ownerInput : ownerInput,
                systemAssessment: systemAssessment,
                summary: itemType === 'kr' ? derivedKR.summary : ownerInput.progressSummary,
            };

            // ... (Next Due Date logic remains common)


            // Calculate Next Due Date
            let nextHeartbeatDue = null;
            if (item.heartbeatCadence) {
                const { frequency, hour = 9 } = item.heartbeatCadence;
                const date = new Date();
                date.setHours(hour, 0, 0, 0);

                // If currently "LATE", we still schedule from *now* or from *scheduled*? 
                // Normally next due is calc from now for rhythm.
                if (frequency === 'DAILY') date.setDate(date.getDate() + 1);
                else if (frequency === 'WEEKLY') date.setDate(date.getDate() + 7);
                else if (frequency === 'BIWEEKLY') date.setDate(date.getDate() + 14);
                else if (frequency === 'MONTHLY') date.setMonth(date.getMonth() + 1);

                nextHeartbeatDue = date.toISOString();
            }

            if (itemType === 'initiative') {
                await client.models.Initiative.update({
                    id: item.id,
                    latestHeartbeat: latestHeartbeat as any,
                    nextHeartbeatDue: nextHeartbeatDue || undefined,
                    state: {
                        ...item.state,
                        updatedAt: now,
                        health: (ownerConfidence || 50) < 50 ? 'off_track' : 'on_track'
                    }
                });
            } else if (itemType === 'outcome') {
                await client.models.Outcome.update({
                    id: item.id,
                    latestHeartbeat: latestHeartbeat as any,
                    nextHeartbeatDue: nextHeartbeatDue || undefined,
                });
            } else if (itemType === 'objective') {
                await client.models.StrategicObjective.update({
                    id: item.id,
                    latestHeartbeat: latestHeartbeat as any,
                    nextHeartbeatDue: nextHeartbeatDue || undefined,
                });
            } else if (itemType === 'kr') {
                await client.models.KeyResult.update({
                    id: item.id,
                    latestHeartbeat: latestHeartbeat as any,
                    nextHeartbeatDue: nextHeartbeatDue || undefined,
                });
            }

            onComplete();
            onClose();
        } catch (e) {
            console.error("Error submitting heartbeat", e);
            alert("Failed to submit heartbeat.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const renderStepContent = (step: number) => {
        if (itemType === 'kr') {
            if (!derivedKR) return <Typography>Calculating Rollup...</Typography>;
            return (
                <Box pt={2}>
                    <Typography variant="h6" gutterBottom>Derived Key Result Heartbeat</Typography>
                    <Typography variant="body2" color="text.secondary" paragraph>
                        This heartbeat is automatically derived from {item.initiatives?.length || 0} linked initiatives.
                    </Typography>

                    <Box bgcolor="grey.50" p={2} borderRadius={1} mb={2} border={1} borderColor="divider">
                        <Typography variant="subtitle2" color="text.secondary">System Calculated Confidence</Typography>
                        <Stack direction="row" spacing={1} alignItems="center" mt={1}>
                            <Chip
                                label={derivedKR.confidence}
                                color={derivedKR.confidence === 'HIGH' ? 'success' : derivedKR.confidence === 'MEDIUM' ? 'warning' : 'error'}
                            />
                            <Typography variant="body2">Trend: {derivedKR.trend}</Typography>
                        </Stack>
                    </Box>

                    <Box>
                        <Typography variant="subtitle2" gutterBottom>Summary</Typography>
                        <Typography variant="body1">{derivedKR.summary}</Typography>
                    </Box>

                    <Box mt={4}>
                        <Typography variant="caption" color="text.secondary">
                            Note: Submitting this will update the Key Result status based on the aggregated data.
                        </Typography>
                    </Box>
                </Box>
            );
        }

        switch (step) {
            case 0: // Context
                return (
                    <Box pt={2}>
                        <Typography variant="h6" gutterBottom>{item.title}</Typography>
                        <Typography variant="body2" color="text.secondary" paragraph>
                            Please provide an update for the current cycle. Your honest assessment drives the system's confidence.
                        </Typography>
                        <Box bgcolor="grey.100" p={2} borderRadius={1}>
                            <Typography variant="subtitle2">Last Confidence: {item.latestHeartbeat?.ownerInput?.ownerConfidence || 'None'}</Typography>
                            <Typography variant="caption" display="block">Last Update: {item.latestHeartbeat?.timestamp ? new Date(item.latestHeartbeat.timestamp).toLocaleDateString() : 'Never'}</Typography>
                        </Box>
                    </Box>
                );
            case 1: // Progress
                return (
                    <Box pt={2}>
                        <Typography variant="subtitle1" gutterBottom>What changed since the last update?</Typography>
                        <TextField
                            multiline
                            rows={6}
                            fullWidth
                            placeholder="Briefly describe progress, decisions made, or blockers removed..."
                            value={progressSummary}
                            onChange={(e) => setProgressSummary(e.target.value)}
                            variant="outlined"
                        />
                    </Box>
                );
            case 2: // Risks & Dependencies
                return (
                    <Box pt={2}>
                        <Typography variant="subtitle1">New Risks</Typography>
                        <Stack spacing={2} mb={2} p={2} bgcolor="grey.50" borderRadius={1} border={1} borderColor="divider">
                            <TextField
                                size="small"
                                fullWidth
                                placeholder="Describe risk..."
                                value={newRiskDesc}
                                onChange={(e) => setNewRiskDesc(e.target.value)}
                            />
                            <Stack direction="row" spacing={2} alignItems="center">
                                <FormControl size="small" sx={{ minWidth: 120 }}>
                                    <InputLabel>Impact</InputLabel>
                                    <Select
                                        value={newRiskImpact}
                                        label="Impact"
                                        onChange={(e) => setNewRiskImpact(e.target.value)}
                                    >
                                        <MenuItem value="Low">Low</MenuItem>
                                        <MenuItem value="Medium">Medium</MenuItem>
                                        <MenuItem value="High">High</MenuItem>
                                        <MenuItem value="Critical">Critical</MenuItem>
                                    </Select>
                                </FormControl>
                                <Box flexGrow={1} px={1}>
                                    <Typography variant="caption" color="text.secondary">Probability: {newRiskProb}%</Typography>
                                    <Slider
                                        value={newRiskProb}
                                        onChange={(_, val) => setNewRiskProb(val as number)}
                                        valueLabelDisplay="auto"
                                        step={5}
                                        min={0}
                                        max={100}
                                    />
                                </Box>
                                <Button variant="contained" onClick={addRisk} disabled={!newRiskDesc.trim()}>Add</Button>
                            </Stack>
                        </Stack>
                        <List dense>
                            {risks.map((r, i) => (
                                <ListItem key={i} secondaryAction={<IconButton edge="end" size="small" onClick={() => setRisks(risks.filter((_, idx) => idx !== i))}><DeleteIcon /></IconButton>}>
                                    <ListItemText
                                        primary={r.description}
                                        secondary={<Typography variant="caption">Impact: {r.impact} | Prob: {r.probability}%</Typography>}
                                    />
                                </ListItem>
                            ))}
                        </List>

                        <Typography variant="subtitle1" mt={2}>Dependencies</Typography>
                        <Box display="flex" gap={1} mb={2}>
                            <TextField
                                size="small"
                                fullWidth
                                placeholder="Describe dependency..."
                                value={newDepDesc}
                                onChange={(e) => setNewDepDesc(e.target.value)}
                            />
                            <Button variant="outlined" onClick={addDependency}>Add</Button>
                        </Box>
                        <List dense>
                            {dependencies.map((d, i) => (
                                <ListItem key={i} secondaryAction={<IconButton edge="end" size="small" onClick={() => setDependencies(dependencies.filter((_, idx) => idx !== i))}><DeleteIcon /></IconButton>}>
                                    <ListItemText primary={d.description} secondary={`Status: ${d.status} `} />
                                </ListItem>
                            ))}
                        </List>
                    </Box>
                );
            case 3: // Confidence
                return (
                    <Box pt={2} display="flex" flexDirection="column" gap={3}>
                        <Box>
                            <Typography variant="subtitle1" gutterBottom>Your Confidence Level: {ownerConfidence}%</Typography>
                            <Slider
                                value={ownerConfidence}
                                onChange={(_, val) => setOwnerConfidence(val as number)}
                                step={5}
                                marks={[
                                    { value: 0, label: 'Low' },
                                    { value: 50, label: 'Medium' },
                                    { value: 100, label: 'High' }
                                ]}
                                min={0}
                                max={100}
                                valueLabelDisplay="auto"
                                sx={{
                                    color: ownerConfidence < 50 ? 'error.main' : ownerConfidence < 80 ? 'warning.main' : 'success.main'
                                }}
                            />
                        </Box>
                        <Box>
                            <Typography variant="subtitle1" gutterBottom>Rationale (Required)</Typography>
                            <Typography variant="caption" color="text.secondary" paragraph>Why is your confidence {ownerConfidence}?</Typography>
                            <TextField
                                multiline
                                rows={4}
                                fullWidth
                                required
                                placeholder="Explain your confidence assessment..."
                                value={confidenceRationale}
                                onChange={(e) => setConfidenceRationale(e.target.value)}
                                error={!confidenceRationale}
                                helperText={!confidenceRationale ? "Rationale is required" : ""}
                            />
                        </Box>
                    </Box>
                );
            case 4: // Review
                return (
                    <Box pt={2}>
                        <Typography variant="h6" gutterBottom>Review Heartbeat</Typography>
                        <Stack spacing={2}>
                            <Box>
                                <Typography variant="caption" color="text.secondary">Progress Summary</Typography>
                                <Typography variant="body2">{progressSummary || 'No summary provided.'}</Typography>
                            </Box>
                            <Box>
                                <Typography variant="caption" color="text.secondary">Confidence</Typography>
                                <Chip
                                    label={`${ownerConfidence}%`}
                                    color={ownerConfidence >= 80 ? 'success' : ownerConfidence >= 50 ? 'warning' : 'error'}
                                    size="small"
                                />
                            </Box>
                            <Box>
                                <Typography variant="caption" color="text.secondary">Rationale</Typography>
                                <Typography variant="body2">{confidenceRationale || 'None'}</Typography>
                            </Box>
                            <Box>
                                <Typography variant="caption" color="text.secondary">Risks Added</Typography>
                                <Typography variant="body2">{risks.length}</Typography>
                            </Box>
                        </Stack>
                    </Box>
                );
            default:
                return null;
        }
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle display="flex" justifyContent="space-between" alignItems="center">
                Log Heartbeat
                <IconButton onClick={onClose}><CloseIcon /></IconButton>
            </DialogTitle>
            <DialogContent dividers>
                <Stepper activeStep={activeStep} alternativeLabel sx={{ mb: 2 }}>
                    {steps.map((label) => (
                        <Step key={label}>
                            <StepLabel>{label}</StepLabel>
                        </Step>
                    ))}
                </Stepper>
                {renderStepContent(activeStep)}
            </DialogContent>
            <DialogActions sx={{ p: 2, justifyContent: 'space-between' }}>
                <Button disabled={activeStep === 0} onClick={handleBack}>Back</Button>
                <Button
                    variant="contained"
                    onClick={handleNext}
                    disabled={
                        (activeStep === 3 && !confidenceRationale) ||
                        (activeStep === 1 && !progressSummary) ||
                        isSubmitting
                    }
                >
                    {activeStep === steps.length - 1 ? (isSubmitting ? 'Submitting...' : 'Submit Heartbeat') : 'Next'}
                </Button>
            </DialogActions>
        </Dialog>
    );
}
