import { useState, useEffect } from "react";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "../../amplify/data/resource";
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    Button,
    Box,
    Typography,
    Stepper,
    Step,
    StepLabel,
    CircularProgress,
    Alert
} from '@mui/material';

import { SUBSCRIPTION_LIMITS, type SubscriptionTier } from '../utils/subscriptionLimits';

const client = generateClient<Schema>();

interface CreateOrganizationWizardProps {
    open: boolean;
    onClose: () => void;
    onSuccess: (org: Schema["Organization"]["type"], membership: Schema["Membership"]["type"]) => void;
    userProfile: Schema["UserProfile"]["type"];
}

export const CreateOrganizationWizard = ({ open, onClose, onSuccess, userProfile }: CreateOrganizationWizardProps) => {
    const [activeStep, setActiveStep] = useState(0);
    const [orgName, setOrgName] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [ownedCount, setOwnedCount] = useState<number | null>(null);

    const currentTier: SubscriptionTier = (userProfile.tier as SubscriptionTier) || 'FREE';
    const limits = SUBSCRIPTION_LIMITS[currentTier];

    useEffect(() => {
        if (open) {
            const checkLimit = async () => {
                const { data: memberships } = await userProfile.memberships();
                const owned = memberships.filter(m => m.role === 'OWNER').length;
                setOwnedCount(owned);
            };
            checkLimit();
        }
    }, [open, userProfile]);

    const steps = ['Organization Details', 'Confirmation'];

    const handleCreate = async () => {
        if (!orgName.trim()) {
            setError("Organization name is required");
            return;
        }

        setLoading(true);
        setError(null);

        try {
            // 1. Create Organization
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { data: newOrg, errors: orgErrors } = await (client.models.Organization as any).create({
                name: orgName.trim(),
            });

            if (orgErrors || !newOrg) {
                throw new Error(orgErrors?.[0]?.message || "Failed to create organization");
            }

            // 2. Create Membership (OWNER)
            const { data: newMem, errors: memErrors } = await client.models.Membership.create({
                role: "OWNER",
                organizationId: newOrg.id,
                userProfileId: userProfile.id,
                status: 'ACTIVE'
            });

            if (memErrors || !newMem) {
                // Determine if we should attempt cleanup of org? 
                // For now, let's just fail.
                throw new Error(memErrors?.[0]?.message || "Failed to create membership");
            }

            // Enrich membership with organization for local state consistency if needed
            // But we pass explicit org and mem back
            onSuccess(newOrg, newMem);
            handleClose();

        } catch (e: unknown) {
            console.error("Wizard Error:", e);
            setError((e instanceof Error ? e.message : String(e)) || "An unexpected error occurred.");
        } finally {
            setLoading(false);
        }
    };

    const handleClose = () => {
        setOrgName("");
        setActiveStep(0);
        setError(null);
        onClose();
    };

    const renderStepContent = (step: number) => {
        switch (step) {
            case 0:
                return (
                    <Box pt={2}>
                        {ownedCount !== null && ownedCount >= limits.maxOrganizations && (
                            <Alert severity="warning" sx={{ mb: 2 }}>
                                You have used {ownedCount} / {limits.maxOrganizations} organizations allowed on the {currentTier} plan.
                            </Alert>
                        )}
                        <Typography variant="body1" gutterBottom>
                            Let's start by naming your new organization. This is usually your company name.
                        </Typography>
                        <TextField
                            autoFocus
                            margin="dense"
                            label="Organization Name"
                            fullWidth
                            variant="outlined"
                            value={orgName}
                            onChange={(e) => setOrgName(e.target.value)}
                            error={!!error}
                            helperText={error}
                            disabled={loading}
                        />
                    </Box>
                );
            case 1:
                return (
                    <Box pt={2}>
                        <Typography variant="h6" gutterBottom>Ready to Create?</Typography>
                        <Typography variant="body1">
                            You are about to create <strong>{orgName}</strong>.
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                            As the creator, you will be assigned the <strong>Owner</strong> role, giving you full control over the organization's settings and members.
                        </Typography>
                        {error && (
                            <Typography color="error" variant="body2" sx={{ mt: 2 }}>
                                Error: {error}
                            </Typography>
                        )}
                    </Box>
                );
            default:
                return null;
        }
    };

    return (
        <Dialog open={open} onClose={loading ? undefined : handleClose} maxWidth="sm" fullWidth>
            <DialogTitle>Create New Organization</DialogTitle>
            <DialogContent>
                <Stepper activeStep={activeStep} sx={{ pt: 2, pb: 2 }}>
                    {steps.map((label) => (
                        <Step key={label}>
                            <StepLabel>{label}</StepLabel>
                        </Step>
                    ))}
                </Stepper>
                {renderStepContent(activeStep)}
            </DialogContent>
            <DialogActions>
                <Button onClick={handleClose} disabled={loading}>
                    Cancel
                </Button>
                {activeStep === 0 ? (
                    <Button
                        variant="contained"
                        onClick={() => {
                            if (orgName.trim()) {
                                setError(null);
                                setActiveStep(1);
                            } else {
                                setError("Name is required");
                            }
                        }}
                    >
                        Next
                    </Button>
                ) : (
                    <Box display="flex" gap={1}>
                        <Button onClick={() => setActiveStep(0)} disabled={loading}>
                            Back
                        </Button>
                        <Button
                            variant="contained"
                            onClick={handleCreate}
                            disabled={loading}
                            startIcon={loading ? <CircularProgress size={20} /> : null}
                        >
                            {loading ? 'Creating...' : 'Create Organization'}
                        </Button>
                    </Box>
                )}
            </DialogActions>
        </Dialog>
    );
};
