import { useState, useEffect } from 'react';
import {
    Box,
    Typography,
    Paper,
    Card,
    CardContent,
    CardActions,
    Button,
    LinearProgress,
    Stack,
    Chip,
    Divider,
    TextField
} from '@mui/material';
import { generateClient } from "aws-amplify/data";
import type { Schema } from "../../amplify/data/resource";
import { SUBSCRIPTION_LIMITS, type SubscriptionTier } from '../utils/subscriptionLimits';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';

const client = generateClient<Schema>();

interface SettingsViewProps {
    org: Schema["Organization"]["type"];
    userProfile: Schema["UserProfile"]["type"];
    onUpdateProfile: () => void;
}

export const SettingsView = ({ org, userProfile, onUpdateProfile }: SettingsViewProps) => {
    const [counts, setCounts] = useState({
        objectives: 0,
        outcomes: 0,
        keyResults: 0,
        initiatives: 0,
        ownedOrgs: 0
    });

    // Controlled state for instructions to ensure persistence works smoothly
    const [instructions, setInstructions] = useState(org.briefingInstructions || '');

    // Initialize state when org changes, but avoid direct setState in effect loop if possible.
    // Ideally, we key the component on org.id to force reset, but here we can just update state when prop changes.
    if (org.briefingInstructions !== instructions && org.briefingInstructions && instructions === '') {
        setInstructions(org.briefingInstructions);
    }

    const currentTier: SubscriptionTier = (userProfile.tier as SubscriptionTier) || 'FREE';
    const limits = SUBSCRIPTION_LIMITS[currentTier];

    useEffect(() => {
        const fetchUsage = async () => {
            try {
                // Fetch basic counts (this might be expensive in a real app, but ok for now)
                const { data: objs } = await org.objectives();
                const { data: outs } = await org.outcomes();
                const { data: krs } = await org.keyResults();
                const { data: inits } = await org.initiatives();

                // Fetch owned organizations
                const { data: memberships } = await userProfile.memberships();
                const owned = memberships.filter(m => m.role === 'OWNER').length;

                setCounts({
                    objectives: objs.length,
                    outcomes: outs.length,
                    keyResults: krs.length,
                    initiatives: inits.length,
                    ownedOrgs: owned
                });
            } catch (e) {
                console.error("Failed to fetch usage:", e);
            }
        };
        fetchUsage();
    }, [org, userProfile]);

    const handleUpgrade = async (tier: SubscriptionTier) => {
        // Mock Stripe Checkout
        if (window.confirm(`Proceed to Stripe Checkout for ${tier} ($${SUBSCRIPTION_LIMITS[tier].price}/mo)?`)) {
            try {
                // In a real app, this would redirect to Stripe or call a Lambda to generate a session
                // For demo, we just update the user profile directly
                await client.models.UserProfile.update({
                    id: userProfile.id,
                    tier: tier,
                    subscriptionStatus: 'ACTIVE'
                });
                alert(`Successfully upgraded to ${tier}!`);
                onUpdateProfile();
            } catch (e) {
                console.error("Upgrade failed:", e);
                alert("Upgrade failed to process.");
            }
        }
    };

    const renderUsageBar = (label: string, current: number, max: number) => (
        <Box mb={2}>
            <Stack direction="row" justifyContent="space-between" mb={0.5}>
                <Typography variant="body2">{label}</Typography>
                <Typography variant="body2" color={current >= max ? "error" : "text.secondary"}>
                    {current} / {max}
                </Typography>
            </Stack>
            <LinearProgress
                variant="determinate"
                value={Math.min((current / max) * 100, 100)}
                color={current >= max ? "error" : "primary"}
                sx={{ height: 8, borderRadius: 1 }}
            />
        </Box>
    );

    return (
        <Box maxWidth="lg" mx="auto">
            <Typography variant="h4" fontWeight="bold" gutterBottom>
                Organization Settings: {org.name}
            </Typography>
            <Typography color="text.secondary" mb={4}>
                Manage your subscription and view customized limits.
            </Typography>

            <Box sx={{ display: 'grid', gap: 4, gridTemplateColumns: { md: 'repeat(3, 1fr)' } }}>
                {/* Usage Section */}
                <Box sx={{ gridColumn: { md: 'span 2' } }}>
                    <Paper variant="outlined" sx={{ p: 4, mb: 4 }}>
                        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
                            <Typography variant="h6">Current Plan Usage</Typography>
                            <Chip
                                label={currentTier}
                                color={currentTier === 'PREMIUM' ? 'secondary' : currentTier === 'BASIC' ? 'primary' : 'default'}
                                sx={{ fontWeight: 'bold' }}
                            />
                        </Stack>
                        <Divider sx={{ mb: 3 }} />

                        {renderUsageBar("Owned Organizations", counts.ownedOrgs, limits.maxOrganizations)}
                        {renderUsageBar("Strategic Objectives", counts.objectives, limits.maxObjectives)}
                        <Typography variant="caption" color="text.secondary">
                            * Limits for Outcomes, Key Results, and Initiatives are enforced per-parent (e.g., max {limits.maxOutcomesPerObjective} Outcomes per Objective).
                        </Typography>
                    </Paper>

                    <Paper variant="outlined" sx={{ p: 4, mb: 4 }}>
                        <Typography variant="h6" mb={2}>Executive Briefing Settings</Typography>
                        <Typography variant="body2" color="text.secondary" paragraph>
                            Customize the instructions provided to the AI when generating executive briefings.
                        </Typography>
                        <TextField
                            label="Additional AI Instructions"
                            multiline
                            rows={3}
                            fullWidth
                            placeholder="e.g., Focus on risk mitigation strategies..."
                            value={instructions}
                            onChange={(e) => setInstructions(e.target.value)}
                            onBlur={async () => {
                                if (instructions !== org.briefingInstructions) {
                                    try {
                                        await client.models.Organization.update({
                                            id: org.id,
                                            briefingInstructions: instructions
                                        });
                                        // Soft notify or verify?
                                        onUpdateProfile(); // Refresh parent to ensure sync
                                    } catch (e) {
                                        console.error("Failed to save instructions", e);
                                    }
                                }
                            }}
                            sx={{ mb: 2 }}
                        />
                    </Paper>

                    <Paper variant="outlined" sx={{ p: 4 }}>
                        <Typography variant="h6" mb={2}>Manage Subscription</Typography>
                        <Typography variant="body2" color="text.secondary" paragraph>
                            Upgrade your plan to unlock more organizations and higher entity limits.
                        </Typography>
                    </Paper>
                </Box>

                {/* Tier Selection */}
                <Box sx={{ gridColumn: { xs: '1 / -1' } }}>
                    <Typography variant="h5" gutterBottom sx={{ mt: 2 }}>Subscription Plans</Typography>
                    <Box sx={{
                        display: 'grid',
                        gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' },
                        gap: 3
                    }}>
                        {(['FREE', 'BASIC', 'PREMIUM'] as SubscriptionTier[]).map((tier) => {
                            const tierLimit = SUBSCRIPTION_LIMITS[tier];
                            const isCurrent = currentTier === tier;
                            return (
                                <Box key={tier}>
                                    <Card variant={isCurrent ? "elevation" : "outlined"} sx={{
                                        height: '100%',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        borderColor: isCurrent ? 'secondary.main' : undefined,
                                        borderWidth: isCurrent ? 2 : 1,
                                        position: 'relative'
                                    }}>
                                        {isCurrent && (
                                            <Box sx={{ position: 'absolute', top: 10, right: 10 }}>
                                                <CheckCircleIcon color="secondary" />
                                            </Box>
                                        )}
                                        <CardContent sx={{ flexGrow: 1 }}>
                                            <Typography variant="h6" color="text.secondary" gutterBottom>
                                                {tierLimit.label}
                                            </Typography>
                                            <Typography variant="h3" fontWeight="bold" gutterBottom>
                                                ${tierLimit.price}<Typography component="span" variant="h6" color="text.secondary">/mo</Typography>
                                            </Typography>
                                            <Stack spacing={1} mt={2}>
                                                <Typography variant="body2">🏠 <b>{tierLimit.maxOrganizations}</b> Organizations</Typography>
                                                <Typography variant="body2">🎯 <b>{tierLimit.maxObjectives}</b> Strategic Objectives</Typography>
                                                <Typography variant="body2">📈 <b>{tierLimit.maxOutcomesPerObjective}</b> Outcomes / Obj</Typography>
                                                <Typography variant="body2">🔑 <b>{tierLimit.maxKeyResultsPerOutcome}</b> Key Results / Outcome</Typography>
                                                <Typography variant="body2">🚀 <b>{tierLimit.maxInitiativesPerKeyResult}</b> Initiatives / KR</Typography>
                                            </Stack>
                                        </CardContent>
                                        <CardActions>
                                            <Button
                                                fullWidth
                                                variant={isCurrent ? "outlined" : "contained"}
                                                color={tier === 'PREMIUM' ? "secondary" : "primary"}
                                                disabled={isCurrent}
                                                onClick={() => handleUpgrade(tier)}
                                            >
                                                {isCurrent ? "Current Plan" : `Upgrade to ${tierLimit.label}`}
                                            </Button>
                                        </CardActions>
                                    </Card>
                                </Box>
                            );
                        })}
                    </Box>
                </Box>
            </Box>
        </Box>
    );
};
