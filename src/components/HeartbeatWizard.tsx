import { useState, useEffect } from 'react';
import {
    Dialog, DialogTitle, DialogContent, DialogActions,
    Button, Typography, Box, TextField, Stack,
    IconButton,
    List, ListItem, ListItemText, Chip, Step, Stepper, StepLabel,
    Slider, Select, MenuItem, FormControl, InputLabel,
    Checkbox, FormControlLabel, CircularProgress
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import DeleteIcon from '@mui/icons-material/Delete';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import { generateClient } from 'aws-amplify/data';
import type { Schema } from '../../amplify/data/resource';

const client = generateClient<Schema>();
import { assessHeartbeat, generateKeyResultRollup } from '../utils/heartbeatLogic';
import { logger } from '../utils/logger';

interface Risk {
    description: string;
    impact: string;
    probability: number;
    roamStatus: 'RESOLVED' | 'OWNED' | 'ACCEPTED' | 'MITIGATED';
}

interface Dependency {
    description: string;
    status: string;
}

type StrategicItem =
    | Schema['Initiative']['type']
    | Schema['Outcome']['type']
    | Schema['StrategicObjective']['type']
    | Schema['KeyResult']['type'];

type KeyResultWithInitiatives = Schema['KeyResult']['type'] & {
    initiatives?: Schema['Initiative']['type'][];
};

interface HeartbeatWizardProps {
    open: boolean;
    onClose: () => void;
    item: StrategicItem;
    itemType: 'initiative' | 'outcome' | 'objective' | 'kr';
    onComplete: () => void;
    editHeartbeatId?: string;
    initialData?: {
        ownerInput?: {
            progressSummary?: string | null;
            confidenceRationale?: string | null;
            ownerConfidence?: number | null;
            metricValue?: number | null;
            newRisks?: { description: string; impact: string; probability?: number | null; roamStatus?: string | null }[] | null;
            dependencies?: { description: string; status: string }[] | null;
        } | null;
    };
}

const steps = ['Context', 'Progress', 'Risks & Dependencies', 'Confidence', 'Review'];

export default function HeartbeatWizard({ open, onClose, item, itemType, onComplete, editHeartbeatId, initialData }: HeartbeatWizardProps) {
    const [activeStep, setActiveStep] = useState(0);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Derived State for KR
    const [derivedKR, setDerivedKR] = useState<{ confidence: string | number; trend: string; summary: string } | null>(null);

    // Form State
    // Metric State
    const [metricValue, setMetricValue] = useState<number | ''>('');

    // Form State
    const [progressSummary, setProgressSummary] = useState('');
    const [risks, setRisks] = useState<Risk[]>([]);
    const [newRiskDesc, setNewRiskDesc] = useState('');
    const [newRiskImpact, setNewRiskImpact] = useState('Medium');
    const [newRiskProb, setNewRiskProb] = useState<number>(50);
    const [newRiskRoam, setNewRiskRoam] = useState<'RESOLVED' | 'OWNED' | 'ACCEPTED' | 'MITIGATED'>('OWNED');

    const [dependencies, setDependencies] = useState<Dependency[]>([]);
    const [newDepDesc, setNewDepDesc] = useState('');

    const [ownerConfidence, setOwnerConfidence] = useState<number>(50);
    const [confidenceRationale, setConfidenceRationale] = useState('');

    const [isAttested, setIsAttested] = useState(false);
    const [isSynthesizing, setIsSynthesizing] = useState(false);

    const synthesizeDraft = async () => {
        setIsSynthesizing(true);
        try {
            let contextStr = '';
            const orgId = item.organizationId;

            // Fetch Initiatives & KRs if needed (Outcome/KR/Objective)
            let allInits: Schema['Initiative']['type'][] = [];
            let allKRs: Schema['KeyResult']['type'][] = [];

            if (['objective', 'outcome', 'kr'].includes(itemType)) {
                try {
                    const [initsRes, krsRes] = await Promise.all([
                        client.models.Initiative.list({ filter: { organizationId: { eq: orgId } } }),
                        ['objective', 'outcome'].includes(itemType)
                            ? client.models.KeyResult.list({ filter: { organizationId: { eq: orgId } } })
                            : Promise.resolve({ data: [] })
                    ]);

                    allInits = initsRes.data;
                    allKRs = krsRes.data as Schema['KeyResult']['type'][];

                } catch (e) {
                    console.log("Failed to fetch context data", e);
                }
            }

            if (itemType === 'objective') {
                const objective = item as Schema['StrategicObjective']['type'];
                const { data: outcomes } = await objective.outcomes();
                contextStr = `Strategic Objective: ${objective.title}\nDescription: ${objective.description}\n\nActivity Data:\n`;
                for (const outcome of outcomes) {
                    contextStr += `Outcome: ${outcome.title} (Status: ${outcome.status})\n`;
                    // Filter KRs in memory
                    const krs = allKRs.filter((k) => k.outcomeId === outcome.id);

                    for (const kr of krs) {
                        const relevantInits = allInits.filter((init) => init.linkedEntities?.keyResultIds?.includes(kr.id));
                        const krConf = kr.latestHeartbeat?.ownerInput?.ownerConfidence || 'N/A';
                        contextStr += `  - KR: ${kr.statement} (Confidence: ${krConf})\n`;
                        for (const init of relevantInits) {
                            const initUpdates = init.latestHeartbeat?.ownerInput?.progressSummary || "No recent updates";
                            contextStr += `    * Initiative: ${init.title}. Update: ${initUpdates}\n`;
                        }
                    }
                }
            } else if (itemType === 'outcome') {
                const outcome = item as Schema['Outcome']['type'];
                // Filter KRs in memory
                const krs = allKRs.filter((k) => k.outcomeId === outcome.id);

                contextStr = `Outcome: ${outcome.title}\nDescription: ${outcome.description}\n\nActivity Data:\n`;
                for (const kr of krs) {
                    const relevantInits = allInits.filter((init) => init.linkedEntities?.keyResultIds?.includes(kr.id));
                    const krConf = kr.latestHeartbeat?.ownerInput?.ownerConfidence || 'N/A';
                    contextStr += `  - KR: ${kr.statement} (Confidence: ${krConf})\n`;
                    for (const init of relevantInits) {
                        const initUpdates = init.latestHeartbeat?.ownerInput?.progressSummary || "No recent updates";
                        contextStr += `    * Initiative: ${init.title}. Update: ${initUpdates}\n`;
                    }
                }
            } else if (itemType === 'kr') {
                const kr = item as Schema['KeyResult']['type'];
                const relevantInits = allInits.filter((init) => init.linkedEntities?.keyResultIds?.includes(kr.id));
                contextStr = `Key Result: ${kr.statement}\nMetric: ${kr.metric?.name}\n\nActivity Data:\n`;
                for (const init of relevantInits) {
                    const initUpdates = init.latestHeartbeat?.ownerInput?.progressSummary || "No recent updates";
                    contextStr += `    * Initiative: ${init.title}. Update: ${initUpdates}\n`;
                }
            } else if (itemType === 'initiative') {
                const init = item as Schema['Initiative']['type'];
                contextStr = `Initiative: ${init.title}\nDescription: ${init.description}\nState: ${init.state?.lifecycle}\n\n`;
                contextStr += "Please draft a professional update for this initiative based on its description and standard progress.";
            }

            // 2. Call LLM
            const systemPrompt = `Analyze the provided context for a ${itemType} and synthesize a Heartbeat Update.
Format your response exactly as follows:

EXECUTIVE_SUMMARY
CONFIDENCE_SCORE: [0-100]
RATIONALE: [One sentence rationale]
###SECTION_SPLIT###
EXECUTIVE_NARRATIVE
PROGRESS: [A concise progress summary paragraph]
RISKS: [Risk Description]|[Impact: High/Medium/Low]|[Probability: 0-100];[Risk Description]|[Impact]|[Probability]

DO NOT output JSON. Use the tags above.`;

            const fullPrompt = `SYSTEM_PROMPT: ${systemPrompt} \n\nCONTEXT_DATA: \n${contextStr}`;
            const { data: response } = await client.queries.generateBriefing({ prompt: fullPrompt });

            if (response) {
                // 3. Parse Response
                const summaryPart = response.summary || "";
                const narrativePart = response.narrative || "";

                // Parse Confidence
                const confMatch = summaryPart.match(/CONFIDENCE_SCORE:\s*(\d+)/i);
                if (confMatch) setOwnerConfidence(Math.min(100, Math.max(0, parseInt(confMatch[1]))));

                // Parse Rationale
                const ratMatch = summaryPart.match(/RATIONALE:\s*(.*)/i);
                if (ratMatch) setConfidenceRationale(ratMatch[1].trim());
                else setConfidenceRationale(summaryPart.replace(/CONFIDENCE_SCORE:.*\n?/, '').trim());

                // Parse Progress
                const progressMatch = narrativePart.match(/PROGRESS:\s*([\s\S]*?)(?=RISKS:|$)/i);
                if (progressMatch) setProgressSummary(progressMatch[1].trim());
                else setProgressSummary(narrativePart);

                // Parse Risks
                const risksMatch = narrativePart.match(/RISKS:\s*([\s\S]*)/i);
                if (risksMatch) {
                    const rawRiskString = risksMatch[1].trim();
                    if (rawRiskString && rawRiskString.toLowerCase() !== 'none') {
                        const riskList = rawRiskString.split(';').map(r => r.trim()).filter(r => r.length > 0);
                        const newRisks = riskList.map(r => {
                            const parts = r.split('|');
                            if (parts.length === 3) {
                                const impactStr = parts[1].trim();
                                // Validate Impact
                                const validImpacts = ['High', 'Medium', 'Low', 'Critical'];
                                const impact = validImpacts.find(i => i.toLowerCase() === impactStr.toLowerCase()) || 'Medium';

                                return {
                                    description: parts[0].trim(),
                                    impact: impact,
                                    probability: parseInt(parts[2].trim()) || 50,
                                    roamStatus: 'OWNED' as const
                                };
                            }
                            // Fallback for old format or failure
                            return { description: r, impact: 'Medium', probability: 50, roamStatus: 'OWNED' as const };
                        });
                        setRisks(prev => [...prev, ...newRisks]);
                    }
                }
            }

        } catch (e) {
            console.error("Synthesis failed", e);
            alert("AI Synthesis failed. Please try again.");
        } finally {
            setIsSynthesizing(false);
        }
    };

    // Reset state when opening for a new item or closing
    useEffect(() => {
        if (open) {
            if (editHeartbeatId && initialData) {
                // Edit Mode: Load Data
                const input = initialData.ownerInput;
                if (input) {
                    setProgressSummary(input.progressSummary || '');
                    setConfidenceRationale(input.confidenceRationale || '');
                    setOwnerConfidence(input.ownerConfidence ?? 50);
                    if (input.metricValue != null) setMetricValue(input.metricValue);

                    if (input.newRisks) {
                        setRisks(input.newRisks.map(r => ({
                            description: r.description,
                            impact: r.impact,
                            probability: r.probability || 50,
                            roamStatus: (r.roamStatus as Risk['roamStatus']) || 'OWNED'
                        })));
                    }
                    if (input.dependencies) {
                        setDependencies(input.dependencies.map(d => ({
                            description: d.description,
                            status: d.status
                        })));
                    }
                }
            } else {
                // New Mode: Reset State
                setActiveStep(0);
                setProgressSummary('');
                setOwnerConfidence(50);
                setConfidenceRationale('');
                setMetricValue('');
                setRisks([]);
                setDependencies([]);
                // Optional: Pre-fill previous confidence rationale/score if desired, but user asked for reset
            }
        }
    }, [open, item.id, editHeartbeatId, initialData]);


    // Calculate KR Rollup on mount
    useState(() => {
        if (itemType === 'kr') {
            const kr = item as KeyResultWithInitiatives;
            const initiatives = kr.initiatives;
            if (initiatives) {
                const mappedInitiatives = initiatives.map(i => ({
                    confidence: i.latestHeartbeat?.systemAssessment?.systemConfidence || i.latestHeartbeat?.ownerInput?.ownerConfidence || 'MEDIUM',
                    title: i.title
                }));
                const rollup = generateKeyResultRollup(mappedInitiatives);
                setDerivedKR({
                    ...rollup,
                    confidence: rollup.confidence as string | number // handling loose type matching for now
                });
            }
        }
    });

    const handleNext = () => {
        // Skip manual entry only for KRs WITHOUT metrics
        const hasMetric = itemType === 'kr' && (item as Schema['KeyResult']['type']).metric;
        if (itemType === 'kr' && !hasMetric) {
            handleSubmit();
        } else if (activeStep === steps.length - 1) {
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
        setRisks([...risks, { description: newRiskDesc, impact: newRiskImpact, probability: newRiskProb, roamStatus: newRiskRoam }]);
        setNewRiskDesc('');
        setNewRiskImpact('Medium');
        setNewRiskProb(50);
        setNewRiskRoam('OWNED');
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
            let heartbeatPayload: Partial<Parameters<typeof client.models.Heartbeat.create>[0]> = {};
            let systemAssessment: Schema['SystemAssessment']['type'] | undefined;
            let ownerInput: Schema['OwnerInput']['type'] | undefined;

            const itemKR = itemType === 'kr' ? (item as KeyResultWithInitiatives) : null;

            // If KR has a metric, treat it as specific data collection (standard flow)
            // Otherwise, use derived rollup
            if (itemKR && !itemKR.metric) {
                // KR Derived Heartbeat (Pure Rollup)
                if (!derivedKR) throw new Error("Rollup calculation failed");

                systemAssessment = {
                    systemConfidence: Number(derivedKR.confidence),
                    confidenceTrend: derivedKR.trend,
                    integritySignals: {
                        updateFreshness: 'ON_TIME', // Assumed for rollup
                        languageSpecificity: 'SPECIFIC',
                        signalConsistency: 'ALIGNED'
                    },
                    uncertaintyFlags: [],
                    factsInferencesRecommendations: {
                        facts: [`Rolled up from ${itemKR?.initiatives?.length || 0} initiatives.`],
                        inferences: [],
                        recommendations: []
                    }
                };

                heartbeatPayload = {
                    type: 'SCHEDULED',
                    status: 'COMPLETED',
                    timestamp: now,
                    keyResultId: item.id,
                    systemAssessment: systemAssessment,
                    // No purely human OwnerInput for KR, but we can store the summary
                    ownerInput: {
                        progressSummary: derivedKR.summary,
                        ownerConfidence: undefined, // Let backend or display logic handle it
                        confidenceRationale: "System Derived Rollup",
                    }
                };

            } else {
                // Standard Initiative/Outcome/Metric-KR Heartbeat Logic
                ownerInput = {
                    progressSummary,
                    ownerConfidence: ownerConfidence || 50,
                    confidenceRationale,
                    metricValue: metricValue !== '' ? Number(metricValue) : undefined,
                    newRisks: risks.map(r => ({
                        id: crypto.randomUUID(),
                        description: r.description,
                        impact: r.impact,
                        probability: r.probability,
                        roamStatus: r.roamStatus
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
                    ownerInput as Schema['OwnerInput']['type'],
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

                    // Note: We are NOT syncing edits back to Risk Register here for now, per instructions simplifiction
                    // "Existing risks will be managed in the Risk Register"

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

                if (itemType === 'initiative') {
                    heartbeatPayload.initiativeId = item.id;
                    heartbeatPayload.outcomeId = undefined;
                    heartbeatPayload.strategicObjectiveId = undefined;
                    heartbeatPayload.keyResultId = undefined;
                } else if (itemType === 'outcome') {
                    heartbeatPayload.outcomeId = item.id;
                    heartbeatPayload.initiativeId = undefined;
                    heartbeatPayload.strategicObjectiveId = undefined;
                    heartbeatPayload.keyResultId = undefined;
                } else if (itemType === 'objective') {
                    heartbeatPayload.strategicObjectiveId = item.id;
                    heartbeatPayload.initiativeId = undefined;
                    heartbeatPayload.outcomeId = undefined;
                    heartbeatPayload.keyResultId = undefined;
                } else if (itemType === 'kr') {
                    heartbeatPayload.keyResultId = item.id;
                    heartbeatPayload.initiativeId = undefined;
                    heartbeatPayload.outcomeId = undefined;
                    heartbeatPayload.strategicObjectiveId = undefined;
                }
            }

            const newHeartbeat = await client.models.Heartbeat.create(heartbeatPayload as Parameters<typeof client.models.Heartbeat.create>[0]);

            // Create Risk Register Entries
            if (risks.length > 0) {
                await Promise.all(risks.map(r => client.models.Risk.create({
                    description: r.description,
                    impact: r.impact.toUpperCase() as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL',
                    probability: r.probability,
                    roamStatus: r.roamStatus,
                    organizationId: item.organizationId,
                    strategicObjectiveId: itemType === 'objective' ? item.id : undefined,
                    outcomeId: itemType === 'outcome' ? item.id : undefined,
                    keyResultId: itemType === 'kr' ? item.id : undefined,
                    initiativeId: itemType === 'initiative' ? item.id : undefined,
                })));
            }

            // 2. Update Parent Latest Heartbeat
            const latestHeartbeat = {
                heartbeatId: newHeartbeat.data?.id || crypto.randomUUID(),
                timestamp: now,
                ownerInput: (itemKR && !itemKR.metric) ? heartbeatPayload.ownerInput : ownerInput,
                systemAssessment: systemAssessment,
                summary: (itemKR && !itemKR.metric) ? derivedKR?.summary : ownerInput?.progressSummary,
            };

            // ... (Next Due Date logic remains common)


            // Calculate Next Due Date
            let nextHeartbeatDue = null;
            const itemCadence = item.heartbeatCadence;
            if (itemCadence) {
                const { frequency, hour } = itemCadence;
                const safeHour = hour ?? 9;
                const date = new Date();
                date.setHours(safeHour, 0, 0, 0);

                if (frequency === 'DAILY') date.setDate(date.getDate() + 1);
                else if (frequency === 'WEEKLY') date.setDate(date.getDate() + 7);
                else if (frequency === 'BIWEEKLY') date.setDate(date.getDate() + 14);
                else if (frequency === 'MONTHLY') date.setMonth(date.getMonth() + 1);

                nextHeartbeatDue = date.toISOString();
            }

            if (itemType === 'initiative') {
                const initItem = item as Schema['Initiative']['type'];
                await client.models.Initiative.update({
                    id: item.id,
                    latestHeartbeat: latestHeartbeat as Schema['InitiativeHeartbeat']['type'],
                    nextHeartbeatDue: nextHeartbeatDue || undefined,
                    state: {
                        ...initItem.state,
                        updatedAt: now,
                        health: (ownerConfidence || 50) < 50 ? 'off_track' : 'on_track'
                    }
                });
            } else if (itemType === 'outcome') {
                await client.models.Outcome.update({
                    id: item.id,
                    latestHeartbeat: latestHeartbeat as Schema['InitiativeHeartbeat']['type'],
                    nextHeartbeatDue: nextHeartbeatDue || undefined,
                });
            } else if (itemType === 'objective') {
                await client.models.StrategicObjective.update({
                    id: item.id,
                    latestHeartbeat: latestHeartbeat as Schema['InitiativeHeartbeat']['type'],
                    nextHeartbeatDue: nextHeartbeatDue || undefined,
                });
            } else if (itemType === 'kr') {
                await client.models.KeyResult.update({
                    id: item.id,
                    latestHeartbeat: latestHeartbeat as Schema['LatestHeartbeat']['type'],
                    nextHeartbeatDue: nextHeartbeatDue || undefined,
                });
            }

            onComplete();
            onClose();
        } catch (e) {
            logger.error("Error submitting heartbeat", e);
            alert("Failed to submit heartbeat.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const renderStepContent = (step: number) => {
        const itemKR = itemType === 'kr' ? (item as KeyResultWithInitiatives) : null;
        const displayTitle = 'title' in item ? item.title : (item as Schema['KeyResult']['type']).statement || 'Unknown Item';

        if (itemType === 'kr' && !itemKR?.metric) {
            if (!derivedKR) return <Typography>Calculating Rollup...</Typography>;
            return (
                <Box pt={2}>
                    <Typography variant="h6" gutterBottom>Derived Key Result Heartbeat</Typography>
                    <Typography variant="body2" color="text.secondary" paragraph>
                        This heartbeat is automatically derived from {itemKR?.initiatives?.length || 0} linked initiatives.
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
                        <Typography variant="h6" gutterBottom>{displayTitle}</Typography>
                        {(item as Schema['KeyResult']['type']).metric && (
                            <Chip label={`Metric: ${(item as Schema['KeyResult']['type']).metric?.name}`} color="primary" variant="outlined" sx={{ mb: 2 }} />
                        )}
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
                        <Box mb={2} display="flex" justifyContent="flex-end">
                            <Button
                                variant="outlined"
                                color="secondary"
                                startIcon={isSynthesizing ? <CircularProgress size={16} /> : <SmartToyIcon />}
                                onClick={synthesizeDraft}
                                disabled={isSynthesizing}
                                size="small"
                            >
                                {isSynthesizing ? "Synthesizing..." : "AI Assist: Synthesize Draft"}
                            </Button>
                        </Box>
                        {(item as Schema['KeyResult']['type']).metric && (
                            <Box mb={3} p={2} bgcolor="primary.light" borderRadius={1} bg-opacity={0.1}>
                                <Typography variant="subtitle2" gutterBottom color="primary.dark">
                                    Current {(item as Schema['KeyResult']['type']).metric?.name} Value
                                </Typography>
                                <TextField
                                    label={`Value ${(item as Schema['KeyResult']['type']).metric?.unit ? `(${(item as Schema['KeyResult']['type']).metric?.unit})` : ''}`}
                                    type="number"
                                    fullWidth
                                    value={metricValue}
                                    onChange={(e) => setMetricValue(Number(e.target.value))}
                                    required
                                    variant="filled"
                                    sx={{ bgcolor: 'white' }}
                                />
                            </Box>
                        )}
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
                                <FormControl size="small" sx={{ minWidth: 120 }}>
                                    <InputLabel>ROAM</InputLabel>
                                    <Select
                                        value={newRiskRoam}
                                        label="ROAM"
                                        onChange={(e) => setNewRiskRoam(e.target.value as Risk['roamStatus'])}
                                    >
                                        <MenuItem value="RESOLVED">Resolved</MenuItem>
                                        <MenuItem value="OWNED">Owned</MenuItem>
                                        <MenuItem value="ACCEPTED">Accepted</MenuItem>
                                        <MenuItem value="MITIGATED">Mitigated</MenuItem>
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
                                        secondary={<Typography variant="caption">Impact: {r.impact} | Prob: {r.probability}% | ROAM: {r.roamStatus}</Typography>}
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

                        <Box mt={3} p={2} bgcolor="warning.50" border={1} borderColor="warning.200" borderRadius={1}>
                            <FormControlLabel
                                control={
                                    <Checkbox
                                        checked={isAttested}
                                        onChange={(e) => setIsAttested(e.target.checked)}
                                        color="primary"
                                    />
                                }
                                label={
                                    <Typography variant="body2" fontWeight="bold">
                                        I attest that this heartbeat update is accurate and reflects the current status of this {itemType === 'kr' ? 'Key Result' : itemType.charAt(0).toUpperCase() + itemType.slice(1)}.
                                    </Typography>
                                }
                            />
                        </Box>
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
                        (activeStep === steps.length - 1 && !isAttested) ||
                        isSubmitting
                    }
                >
                    {activeStep === steps.length - 1 ? (isSubmitting ? 'Submitting...' : 'Submit Heartbeat') : 'Next'}
                </Button>
            </DialogActions>
        </Dialog>
    );
}
