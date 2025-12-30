
import { useState, useEffect } from 'react';
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



    useEffect(() => {
        if (open && organizationId) {
            loadContext();
        }
    }, [open, organizationId]);

    const loadContext = async () => {
        setLoading(true);
        try {
            // 1. Fetch Org Settings (Instructions)
            const { data: org } = await client.models.Organization.get({ id: organizationId! });
            setInstructions(org?.briefingInstructions || '');

            // 2. Fetch All Initiatives for the Org (to map later)
            const { data: allInitiatives } = await client.models.Initiative.list({
                filter: { organizationId: { eq: organizationId! } }
            });

            // 3. Fetch Deep Tree
            const { data: objs } = await client.models.StrategicObjective.list({
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
    };

    const handleGenerate = async () => {
        setLoading(true);

        const systemPrompt = `As a senior executive, please summarize the current state of our strategic objectives.
Provide two outputs in a JSON object:
1. "summary": A 2-sentence executive summary of the overall status.
2. "narrative": A clear, concise executive level narrative of where these objectives currently stand and how this will impact the business.

DO NOT MAKE UP ANY FACTS or embellish the material. Use the provided context data.
Ensure the response is valid JSON.`;
        const fullPrompt = `SYSTEM_PROMPT: ${systemPrompt} \n\nADDITIONAL_INSTRUCTIONS: ${instructions} \n\nCONTEXT_DATA_JSON: \n${contextData} `;

        try {
            const { data, errors } = await client.queries.generateBriefing({ prompt: fullPrompt });
            if (errors) throw new Error(errors[0].message);
            if (data) {
                // @ts-ignore - Schema updated but types might lag in IDE
                setGeneratedNarrative(data.narrative || '');
                // @ts-ignore
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
        const systemPrompt = `As a senior executive, please summarize the current state of our strategic objectives... (JSON format requested)`;
        const fullPrompt = `SYSTEM_PROMPT: ${systemPrompt} \n\nADDITIONAL_INSTRUCTIONS: ${instructions} \n\nCONTEXT_DATA_JSON: \n${contextData} `;
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
                                        <Paper variant="outlined" sx={{ p: 3, bgcolor: 'primary.50', borderColor: 'primary.200' }}>
                                            <Typography variant="subtitle2" color="primary.main" gutterBottom fontWeight="bold">
                                                EXECUTIVE SUMMARY
                                            </Typography>
                                            <Typography variant="h6" component="p" sx={{ fontSize: '1.25rem', lineHeight: 1.4 }}>
                                                {generatedSummary}
                                            </Typography>
                                        </Paper>
                                    )}
                                    <Paper sx={{ p: 4, bgcolor: 'white' }}>
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
