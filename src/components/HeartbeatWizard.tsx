import { useState } from 'react';
import {
    Dialog, DialogTitle, DialogContent, DialogActions,
    Button, Typography, Box, TextField, Stack,
    ToggleButton, ToggleButtonGroup, IconButton,
    List, ListItem, ListItemText, Chip, Step, Stepper, StepLabel
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import DeleteIcon from '@mui/icons-material/Delete';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../amplify/data/resource';

const client = generateClient<Schema>();

interface HeartbeatWizardProps {
    open: boolean;
    onClose: () => void;
    initiative: any; // Using any for now to avoid strict typing issues with generated schema immediately
    onComplete: () => void;
}

const steps = ['Context', 'Progress', 'Risks & Dependencies', 'Confidence', 'Review'];

export default function HeartbeatWizard({ open, onClose, initiative, onComplete }: HeartbeatWizardProps) {
    const [activeStep, setActiveStep] = useState(0);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Form State
    const [progressSummary, setProgressSummary] = useState('');
    const [risks, setRisks] = useState<{ description: string, impact: string }[]>([]);
    const [newRiskDesc, setNewRiskDesc] = useState('');
    const [dependencies, setDependencies] = useState<{ description: string, status: string }[]>([]);
    const [newDepDesc, setNewDepDesc] = useState('');

    const [ownerConfidence, setOwnerConfidence] = useState<string | null>(null);
    const [confidenceRationale, setConfidenceRationale] = useState('');

    const handleNext = () => {
        if (activeStep === steps.length - 1) {
            handleSubmit();
        } else {
            setActiveStep((prev) => prev + 1);
        }
    };

    const handleBack = () => {
        setActiveStep((prev) => prev - 1);
    };

    const addRisk = () => {
        if (!newRiskDesc.trim()) return;
        setRisks([...risks, { description: newRiskDesc, impact: 'Medium' }]); // Default impact
        setNewRiskDesc('');
    };

    const addDependency = () => {
        if (!newDepDesc.trim()) return;
        setDependencies([...dependencies, { description: newDepDesc, status: 'Active' }]);
        setNewDepDesc('');
    };

    const handleSubmit = async () => {
        setIsSubmitting(true);
        try {
            // Create History Record
            const now = new Date().toISOString();

            // Construct OwnerInput object
            const ownerInput = {
                progressSummary,
                ownerConfidence: ownerConfidence || 'MEDIUM',
                confidenceRationale,
                newRisks: risks.map(r => ({
                    id: crypto.randomUUID(),
                    description: r.description,
                    impact: r.impact,
                    probability: 'Medium'
                })),
                dependencies: dependencies.map(d => ({
                    id: crypto.randomUUID(),
                    description: d.description,
                    status: d.status,
                    owner: 'External'
                })),
                milestoneStatus: 'On Track' // Default for now
            };

            // 1. Create Heartbeat Record
            await client.models.Heartbeat.create({
                type: 'SCHEDULED', // Defaulting to scheduled for manual entry
                status: 'COMPLETED',
                timestamp: now,
                initiativeId: initiative.id,
                ownerInput: ownerInput,
                // In a real system, systemAssessment would be calculated here or via trigger
                systemAssessment: {
                    systemConfidence: ownerConfidence || 'MEDIUM', // Fallback for now
                    confidenceTrend: 'FLAT',
                    uncertaintyFlags: [],
                    // integritySignals: ... 
                } as any // avoiding strict type check on nested custom types for speed
            });

            // 2. Update Initiative Latest Heartbeat
            // We need to construct the InitiativeHeartbeat structure
            const latestHeartbeat = {
                heartbeatId: crypto.randomUUID(), // Ideally the ID of the created heartbeat, but create returns promise
                timestamp: now,
                ownerInput: ownerInput,
                // systemAssessment...
            };

            await client.models.Initiative.update({
                id: initiative.id,
                latestHeartbeat: latestHeartbeat as any, // Update custom type
                state: {
                    ...initiative.state,
                    updatedAt: now,
                    health: ownerConfidence === 'LOW' ? 'off_track' : 'on_track' // Simple logic
                }
            });

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
        switch (step) {
            case 0: // Context
                return (
                    <Box pt={2}>
                        <Typography variant="h6" gutterBottom>{initiative.title}</Typography>
                        <Typography variant="body2" color="text.secondary" paragraph>
                            Please provide an update for the current cycle. Your honest assessment drives the system's confidence.
                        </Typography>
                        <Box bgcolor="grey.100" p={2} borderRadius={1}>
                            <Typography variant="subtitle2">Last Confidence: {initiative.latestHeartbeat?.ownerInput?.ownerConfidence || 'None'}</Typography>
                            <Typography variant="caption" display="block">Last Update: {initiative.state?.updatedAt ? new Date(initiative.state.updatedAt).toLocaleDateString() : 'Never'}</Typography>
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
                        <Box display="flex" gap={1} mb={2}>
                            <TextField
                                size="small"
                                fullWidth
                                placeholder="Describe risk..."
                                value={newRiskDesc}
                                onChange={(e) => setNewRiskDesc(e.target.value)}
                            />
                            <Button variant="outlined" onClick={addRisk}>Add</Button>
                        </Box>
                        <List dense>
                            {risks.map((r, i) => (
                                <ListItem key={i} secondaryAction={<IconButton edge="end" size="small" onClick={() => setRisks(risks.filter((_, idx) => idx !== i))}><DeleteIcon /></IconButton>}>
                                    <ListItemText primary={r.description} secondary={`Impact: ${r.impact} `} />
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
                            <Typography variant="subtitle1" gutterBottom>Your Confidence Level</Typography>
                            <ToggleButtonGroup
                                value={ownerConfidence}
                                exclusive
                                onChange={(_, val) => setOwnerConfidence(val)}
                                fullWidth
                                color="primary"
                            >
                                <ToggleButton value="HIGH" color="success">HIGH</ToggleButton>
                                <ToggleButton value="MEDIUM" color="warning">MEDIUM</ToggleButton>
                                <ToggleButton value="LOW" color="error">LOW</ToggleButton>
                            </ToggleButtonGroup>
                        </Box>
                        {ownerConfidence && (
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
                                    error={!confidenceRationale && !!ownerConfidence}
                                    helperText={!confidenceRationale && !!ownerConfidence ? "Rationale is required" : ""}
                                />
                            </Box>
                        )}
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
                                <Chip label={ownerConfidence || 'Not set'} color={ownerConfidence === 'HIGH' ? 'success' : ownerConfidence === 'MEDIUM' ? 'warning' : 'error'} size="small" />
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
                        (activeStep === 3 && (!ownerConfidence || !confidenceRationale)) ||
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
