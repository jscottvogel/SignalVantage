import { useState, useEffect, useCallback } from "react";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "../../amplify/data/resource";
import {
    Box,
    Typography,
    Button,
    Avatar,
    Paper,
    CircularProgress,
    Stack,
    List,
    ListItem,
    ListItemIcon,
    ListItemText,

    Chip
} from '@mui/material';
import MarkEmailReadIcon from '@mui/icons-material/MarkEmailRead';
import BusinessIcon from '@mui/icons-material/Business';
import ExitToAppIcon from '@mui/icons-material/ExitToApp';

const client = generateClient<Schema>();

interface ProfileViewProps {
    userProfile: Schema["UserProfile"]["type"];
    onProfileUpdate: () => void;
    onCreateOrganization: () => void;
}

export const ProfileView = ({ userProfile, onProfileUpdate, onCreateOrganization }: ProfileViewProps) => {
    const [invites, setInvites] = useState<(Schema["Membership"]["type"] & { organization?: Schema["Organization"]["type"] })[]>([]);
    const [loading, setLoading] = useState(false);
    const [myOrgs, setMyOrgs] = useState<(Schema["Membership"]["type"] & { organization?: Schema["Organization"]["type"] })[]>([]);

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            // Load pending invites
            if (userProfile?.email) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const { data: foundInvites } = await (client.models.Membership as any).list({
                    filter: {
                        inviteEmail: { eq: userProfile.email },
                        status: { eq: 'INVITED' }
                    }
                });

                // Enrich invites with org data
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const enrichedInvites = await Promise.all(foundInvites.map(async (inv: any) => {
                    const { data: org } = await inv.organization();
                    return { ...inv, organization: org };
                }));
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                setInvites(enrichedInvites as any);
            }

            // Load my orgs
            const { data: memberships } = await userProfile.memberships();
            const activeMemberships = await Promise.all(memberships.map(async (m) => {
                if (m.status && m.status !== 'ACTIVE') return null;
                const { data: org } = await m.organization();
                return { ...m, organization: org };
            }));
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            setMyOrgs(activeMemberships.filter(m => m !== null) as any);

        } catch (e) {
            console.error("Error loading profile data", e);
        } finally {
            setLoading(false);
        }
    }, [userProfile]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const handleAccept = async (inviteId: string) => {
        try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (client.models.Membership as any).update({
                id: inviteId,
                userProfileId: userProfile.id,
                status: 'ACTIVE'
            });
            alert("Invitation accepted! You can now switch to this organization.");
            onProfileUpdate(); // Refresh parent state
        } catch (e) {
            console.error("Failed to accept", e);
            alert("Failed to accept invitation");
        }
    };

    const handleLeave = async (membership: Schema["Membership"]["type"] & { organization?: Schema["Organization"]["type"] }) => {
        const orgName = membership.organization?.name || 'this organization';
        if (!window.confirm(`Are you sure you want to leave ${orgName}?`)) return;

        try {
            setLoading(true);
            // 1. Fetch organization details to get all members (for ownership check and reassignment)
            const orgId = membership.organizationId;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { data: orgRestored } = await (client.models.Organization as any).get({ id: orgId });

            if (!orgRestored) {
                alert("Organization not found.");
                setLoading(false);
                return;
            }

            const { data: allMembers } = await orgRestored.members();

            // Enrich members to get profile info
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const membersWithProfiles = await Promise.all(allMembers.map(async (m: any) => {
                if (m.userProfileId) {
                    const { data: p } = await m.user();
                    return { ...m, profile: p };
                }
                return m;
            }));

            // 2. Safety Check: Last Owner
            const owners = membersWithProfiles.filter(m => m.role === 'OWNER');
            if (membership.role === 'OWNER' && owners.length <= 1) {
                alert("You are the last owner of this organization. You cannot leave without deleting the organization or appointing another owner.");
                setLoading(false);
                return;
            }

            // 3. Determine Target Owner for Reassignment
            // Type assertion needed because we know we filtered for owners
            const targetOwnerMember = owners.find(m => m.userProfileId !== userProfile.id) as (typeof owners[0] & { profile: Schema["UserProfile"]["type"] }) | undefined;

            if (!targetOwnerMember || !targetOwnerMember.profile) {
                alert("Could not find another owner to reassign your work to.");
                setLoading(false);
                return;
            }

            const targetOwner = {
                userId: targetOwnerMember.profile.id,
                displayName: targetOwnerMember.profile.preferredName || 'Organization Owner',
                role: 'OWNER' as const // fix string inference
            };

            const removedUserId = userProfile.id;

            // 4. Reassign Entities
            const { data: objs } = await orgRestored.objectives();
            const { data: outcomes } = await orgRestored.outcomes();
            const { data: krs } = await orgRestored.keyResults();
            const { data: inits } = await orgRestored.initiatives();

            const updates: Promise<unknown>[] = [];

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            objs.forEach((o: any) => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                if (o.owner?.userId === removedUserId) updates.push((client.models.StrategicObjective as any).update({ id: o.id, owner: targetOwner }));
            });
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            outcomes.forEach((o: any) => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                if (o.owner?.userId === removedUserId) updates.push((client.models.Outcome as any).update({ id: o.id, owner: targetOwner }));
            });
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            krs.forEach((k: any) => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                if (k.owners?.some((ow: any) => ow?.userId === removedUserId)) {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const newOwners = k.owners!.map((ow: any) => ow?.userId === removedUserId ? targetOwner : ow).filter(Boolean); // Filter nulls if any
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    updates.push((client.models.KeyResult as any).update({ id: k.id, owners: newOwners as any }));
                }
            });
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            inits.forEach((i: any) => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                if (i.owner?.userId === removedUserId) updates.push((client.models.Initiative as any).update({ id: i.id, owner: targetOwner }));
            });

            await Promise.all(updates);

            // 5. Delete Membership
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (client.models.Membership as any).delete({ id: membership.id });

            alert(`You have left ${orgName}.`);
            onProfileUpdate(); // Refresh UI/Re-bootstrap
        } catch (e) {
            console.error("Failed to leave organization", e);
            alert("An error occurred while trying to leave the organization.");
        } finally {
            setLoading(false);
        }
    };

    if (!userProfile || loading) return <Box p={4} textAlign="center"><CircularProgress /></Box>;

    return (
        <Box maxWidth="md">
            <Typography variant="h4" gutterBottom fontWeight="bold" mb={4}>My Profile</Typography>

            <Paper variant="outlined" sx={{ p: 4, mb: 4 }}>
                <Stack direction="row" spacing={3} alignItems="center" mb={4}>
                    <Avatar sx={{ width: 80, height: 80, fontSize: '2rem' }}>
                        {userProfile.preferredName?.[0]?.toUpperCase()}
                    </Avatar>
                    <Box>
                        <Typography variant="h5" fontWeight="bold">{userProfile.preferredName}</Typography>
                        <Typography variant="body1" color="text.secondary">{userProfile.email}</Typography>
                    </Box>
                </Stack>
            </Paper>

            <Typography variant="h6" gutterBottom>Pending Invitations</Typography>
            {invites.length === 0 ? (
                <Paper variant="outlined" sx={{ p: 4, mb: 4, textAlign: 'center', bgcolor: 'rgba(0,0,0,0.02)' }}>
                    <Typography color="text.secondary">No pending invitations.</Typography>
                </Paper>
            ) : (
                <Stack spacing={2} mb={4}>
                    {invites.map(inv => (
                        <Paper key={inv.id} variant="outlined" sx={{ p: 2 }}>
                            <Stack direction="row" justifyContent="space-between" alignItems="center">
                                <Box>
                                    <Typography variant="subtitle1" fontWeight="bold">
                                        Invited to join {inv.organization?.name || 'an Organization'}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary">
                                        Role: {inv.role}
                                    </Typography>
                                </Box>
                                <Button
                                    variant="contained"
                                    color="primary"
                                    startIcon={<MarkEmailReadIcon />}
                                    onClick={() => handleAccept(inv.id)}
                                >
                                    Accept & Join
                                </Button>
                            </Stack>
                        </Paper>
                    ))}
                </Stack>
            )}

            <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="h6">My Organizations</Typography>
                <Button variant="outlined" onClick={onCreateOrganization}>
                    Create Organization
                </Button>
            </Stack>
            <Paper variant="outlined">
                <List>
                    {myOrgs.map((m, idx) => (
                        <Box key={m.id}>
                            <ListItem
                                divider={idx < myOrgs.length - 1}
                            >
                                <ListItemIcon>
                                    <BusinessIcon color="action" />
                                </ListItemIcon>
                                <ListItemText
                                    primary={
                                        <Stack direction="row" alignItems="center" spacing={2}>
                                            <Typography variant="body1">{m.organization?.name}</Typography>
                                            {m.role === 'OWNER' && <Chip label="Owner" size="small" color="primary" variant="outlined" />}
                                        </Stack>
                                    }
                                    secondary={`Role: ${m.role}`}
                                />
                                <Button
                                    color="error"
                                    size="small"
                                    onClick={() => handleLeave(m)}
                                    startIcon={<ExitToAppIcon />}
                                    sx={{ ml: 2, minWidth: '100px' }}
                                >
                                    Leave
                                </Button>
                            </ListItem>
                        </Box>
                    ))}
                </List>
            </Paper>
        </Box>
    );
};
