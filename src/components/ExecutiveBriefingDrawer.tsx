
import { useState, useEffect, useCallback } from 'react';
import {
    Drawer, Box, Typography, IconButton, Stack, Button,
    Paper, CircularProgress, Alert
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import { generateClient } from "aws-amplify/data";
import type { Schema } from '../../amplify/data/resource';


const client = generateClient<Schema>();

interface Props {
    open: boolean;
    onClose: () => void;
    // We pass the org Id to fetch fresh, deep context
    organizationId?: string;
}

export function ExecutiveBriefingDrawer({ open, onClose, organizationId }: Props) {
    const [loading, setLoading] = useState(false);
    const [contextData, setContextData] = useState<string>('');
    const [generatedNarrative, setGeneratedNarrative] = useState('');
    const [generatedSummary, setGeneratedSummary] = useState('');
    const [instructions, setInstructions] = useState('');



    const loadContext = useCallback(async () => {
        setLoading(true);
        try {
            // 1. Fetch Org Settings (Instructions)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { data: org } = await (client.models.Organization as any).get({ id: organizationId! });
            setInstructions(org?.briefingInstructions || '');

            // 2. Fetch All Initiatives for the Org (to map later)
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { data: allInitiatives } = await (client.models.Initiative as any).list({
                filter: { organizationId: { eq: organizationId! } }
            });

            // 3. Fetch Deep Tree
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { data: objs } = await (client.models.StrategicObjective as any).list({
                filter: { organizationId: { eq: organizationId! } }
            });

            const deepContext = await Promise.all(objs.map(async (obj) => {
                const { data: outcomes } = await obj.outcomes();
                const outcomesWithChildren = await Promise.all(outcomes.map(async (outcome) => {
                    const { data: krs } = await outcome.keyResults();
                    const krsWithChildren = await Promise.all(krs.map(async (kr) => {
                        // Filter initiatives that link to this KR
                        const linkedInits = allInitiatives.filter(init =>
                            init.linkedEntities?.keyResultIds?.includes(kr.id)
                        );

                        return {
                            ...kr,
                            initiatives: linkedInits,
                            latestHeartbeat: kr.latestHeartbeat
                        };
                    }));
                    return {
                        ...outcome,
                        keyResults: krsWithChildren,
                        latestHeartbeat: outcome.latestHeartbeat
                    };
                }));

                return {
                    ...obj,
                    outcomes: outcomesWithChildren,
                    latestHeartbeat: obj.latestHeartbeat
                };
            }));

            // 4. Serialize & Store

            setContextData(JSON.stringify(deepContext, null, 2));

        } catch (e) {
            console.error("Failed to load briefing context", e);
        } finally {
            setLoading(false);
        }
    }, [organizationId]);

    useEffect(() => {
        if (open && organizationId) {
            setGeneratedNarrative('');
            setGeneratedSummary('');
            loadContext();
        }
    }, [open, organizationId, loadContext]);

    const getPrompt = () => {
        const systemPrompt = `As a senior executive, please summarize the current state of our strategic objectives.
Format your response exactly as follows:

EXECUTIVE_SUMMARY
[A 2-sentence executive summary]
###SECTION_SPLIT###
EXECUTIVE_NARRATIVE
[A clear, concise executive level narrative]

DO NOT output JSON. DO NOT use markdown code blocks.
DO NOT MAKE UP ANY FACTS or embellish the material. Use the provided context data.`;
        return `SYSTEM_PROMPT: ${systemPrompt} \n\nADDITIONAL_INSTRUCTIONS: ${instructions} \n\nCONTEXT_DATA: \n${contextData} `;
    };

    const handleGenerate = async () => {
        setLoading(true);
        const fullPrompt = getPrompt();

        try {
            const { data, errors } = await client.queries.generateBriefing({ prompt: fullPrompt });
            if (errors) throw new Error(errors[0].message);
            if (data) {
                setGeneratedNarrative(data.narrative || '');
                setGeneratedSummary(data.summary || '');
            }
        } catch (e) {
            console.error(e);
            alert("Failed to generate briefing. Please try again or check your context size.");
        } finally {
            setLoading(false);
        }
    };

    const handleCopyPrompt = () => {
        const fullPrompt = getPrompt();
        navigator.clipboard.writeText(fullPrompt);
        alert("Full prompt with context copied to clipboard!");
    };

    return (
        <Drawer
            anchor="bottom"
            open={open}
            onClose={onClose}
            PaperProps={{
                sx: {
                    height: '85vh',
                    borderTopLeftRadius: 16,
                    borderTopRightRadius: 16,
                    maxWidth: '900px',
                    mx: 'auto'
                }
            }}
        >
            <Box height="100%" display="flex" flexDirection="column">
                {/* Header */}
                <Box p={3} display="flex" justifyContent="space-between" alignItems="center" borderBottom={1} borderColor="divider">
                    <Box display="flex" alignItems="center" gap={2}>
                        <Box bgcolor="secondary.main" color="white" p={1} borderRadius={2} display="flex">
                            <SmartToyIcon />
                        </Box>
                        <Box>
                            <Typography variant="h6" fontWeight="bold">Executive Briefing</Typography>
                            <Typography variant="caption" color="text.secondary">
                                AI-synthesized narrative (Context Gathering Mode)
                            </Typography>
                        </Box>
                    </Box>
                    <IconButton onClick={onClose} edge="end">
                        <CloseIcon />
                    </IconButton>
                </Box>

                {/* Content */}
                <Box p={4} flexGrow={1} overflow="auto" bgcolor="#f8fafc">
                    {loading ? (
                        <Box display="flex" flexDirection="column" alignItems="center" justifyContent="center" height="50vh">
                            <CircularProgress size={40} sx={{ mb: 2 }} />
                            <Typography color="text.secondary">Gathering strategic context...</Typography>
                        </Box>
                    ) : (
                        <Stack spacing={3}>
                            <Alert severity="info">
                                Context gathered from {contextData ? JSON.parse(contextData).length : 0} Strategic Objectives.
                            </Alert>

                            {generatedNarrative ? (
                                <Stack spacing={3}>
                                    {generatedSummary && (
                                        <Paper variant="outlined" sx={{ p: 3, bgcolor: 'primary.50', borderColor: 'primary.200', position: 'relative' }}>
                                            <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
                                                <Typography variant="subtitle2" color="primary.main" fontWeight="bold">
                                                    EXECUTIVE SUMMARY
                                                </Typography>
                                                <IconButton
                                                    size="small"
                                                    onClick={() => {
                                                        navigator.clipboard.writeText(generatedSummary);
                                                        alert("Summary copied to clipboard!");
                                                    }}
                                                    sx={{ position: 'absolute', top: 8, right: 8 }}
                                                >
                                                    <ContentCopyIcon fontSize="small" />
                                                </IconButton>
                                            </Box>
                                            <Typography variant="h6" component="p" sx={{ fontSize: '1.25rem', lineHeight: 1.4, pr: 4 }}>
                                                {generatedSummary}
                                            </Typography>
                                        </Paper>
                                    )}
                                    <Paper sx={{ p: 4, bgcolor: 'white', position: 'relative' }}>
                                        <IconButton
                                            size="small"
                                            onClick={() => {
                                                navigator.clipboard.writeText(generatedNarrative);
                                                alert("Narrative copied to clipboard!");
                                            }}
                                            sx={{ position: 'absolute', top: 16, right: 16 }}
                                        >
                                            <ContentCopyIcon />
                                        </IconButton>
                                        <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap', fontFamily: 'serif', fontSize: '1.1rem' }}>
                                            {generatedNarrative}
                                        </Typography>
                                    </Paper>
                                </Stack>
                            ) : (
                                <Box textAlign="center" py={8}>
                                    <SmartToyIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
                                    <Typography variant="h6" color="text.secondary" gutterBottom>
                                        Ready to Generate
                                    </Typography>
                                    <Typography color="text.secondary" sx={{ maxWidth: 500, mx: 'auto', mb: 4 }}>
                                        We have assembled the full tree of Objectives, Outcomes, Key Results, and Heartbeats.
                                        Click below to generate the narrative.
                                    </Typography>
                                    <Stack direction="row" spacing={2} justifyContent="center">
                                        <Button variant="contained" size="large" onClick={handleGenerate} startIcon={<SmartToyIcon />}>
                                            Generate Narrative
                                        </Button>
                                        <Button variant="outlined" size="large" onClick={handleCopyPrompt} startIcon={<ContentCopyIcon />}>
                                            Copy Prompt (for external LLM)
                                        </Button>
                                    </Stack>
                                </Box>
                            )}


                        </Stack>
                    )}
                </Box>
            </Box>
        </Drawer>
    );
}
