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
    Divider,
    Chip,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    IconButton
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';

const client = generateClient<Schema>();

interface TeamViewProps {
    org: Schema["Organization"]["type"];
}

export const TeamView = ({ org }: TeamViewProps) => {
    const [members, setMembers] = useState<(Schema["Membership"]["type"] & { profile?: Schema["UserProfile"]["type"] })[]>([]);
    const [loading, setLoading] = useState(true);

    // Invite State
    const [inviteOpen, setInviteOpen] = useState(false);
    const [inviteEmail, setInviteEmail] = useState('');
    const [isInviting, setIsInviting] = useState(false);

    const fetchMembers = useCallback(async () => {
        try {
            const { data: membershipList } = await org.members();
            const membersWithProfiles = await Promise.all(
                membershipList.map(async (m) => {
                    let profile: Schema["UserProfile"]["type"] | null = null;
                    if (m.userProfileId) {
                        try {
                            const { data } = await m.user();
                            profile = data;
                        } catch (e) {
                            console.warn("Failed to fetch user profile", e);
                        }
                    }
                    // specific status inference for legacy records
                    const effectiveStatus = m.status || (m.userProfileId ? 'ACTIVE' : 'INVITED');
                    return { ...m, profile, status: effectiveStatus };
                })
            );
            // Filter out any potential nulls if map failed, though here we return objects always
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            setMembers(membersWithProfiles as any); // Cast due to effectiveStatus override
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, [org]);

    useEffect(() => {
        let mounted = true;
        if (mounted) fetchMembers();
        return () => { mounted = false; };
    }, [fetchMembers]);

    const handleInvite = async () => {
        if (!inviteEmail.trim()) return;
        setIsInviting(true);
        try {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { errors } = await (client.models.Membership as any).create({
                organizationId: org.id,
                inviteEmail: inviteEmail,
                status: 'INVITED',
                role: 'MEMBER'
            });
            if (errors) throw new Error(errors[0].message);

            await fetchMembers();
            setInviteOpen(false);
            setInviteEmail('');
        } catch (e) {
            console.error("Invitation failed", e);
            alert("Failed to invite member.");
        } finally {
            setIsInviting(false);
        }
    };

    const handleRemove = async (member: Schema["Membership"]["type"] & { profile?: Schema["UserProfile"]["type"] }) => {
        if (member.role === 'OWNER') {
            const ownerCount = members.filter(m => m.role === 'OWNER').length;
            if (ownerCount <= 1) {
                alert("The last Organization Owner cannot be removed.");
                return;
            }
        }

        if (!window.confirm(`Are you sure you want to remove ${member.profile?.preferredName || member.inviteEmail}? Objects owned by them will be reassigned to the Organization Owner.`)) return;

        try {
            if (member.userProfileId && member.profile) {
                // Find Owner
                const ownerMember = members.find(m => m.role === 'OWNER');
                if (ownerMember && ownerMember.profile) {
                    const ownerId = ownerMember.profile.id;
                    const ownerName = ownerMember.profile.preferredName || 'Organization Owner';
                    const targetOwner = { userId: ownerId, displayName: ownerName, role: 'OWNER' as const };
                    const removedUserId = member.userProfileId;

                    const { data: objs } = await org.objectives();
                    const { data: outcomes } = await org.outcomes();
                    const { data: krs } = await org.keyResults();
                    const { data: inits } = await org.initiatives();

                    const updates: Promise<unknown>[] = [];

                    objs.forEach(o => {
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        if (o.owner?.userId === removedUserId) updates.push((client.models.StrategicObjective as any).update({ id: o.id, owner: targetOwner }));
                    });
                    outcomes.forEach(o => {
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        if (o.owner?.userId === removedUserId) updates.push((client.models.Outcome as any).update({ id: o.id, owner: targetOwner }));
                    });
                    krs.forEach(k => {
                        if (k.owners?.some((ow) => ow?.userId === removedUserId)) {
                            const newOwners = k.owners!.map((ow) => ow?.userId === removedUserId ? targetOwner : ow).filter(Boolean);
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            updates.push((client.models.KeyResult as any).update({ id: k.id, owners: newOwners as any }));
                        }
                    });
                    inits.forEach(i => {
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        if (i.owner?.userId === removedUserId) updates.push((client.models.Initiative as any).update({ id: i.id, owner: targetOwner }));
                    });

                    await Promise.all(updates);
                }
            }

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            await (client.models.Membership as any).delete({ id: member.id });
            fetchMembers();
        } catch (e) {
            console.error("Remove failed", e);
            alert("Failed to remove member.");
        }
    };

    if (loading) return <Box p={4}><CircularProgress /></Box>;

    return (
        <Box>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={4}>
                <Box>
                    <Typography variant="h4" gutterBottom fontWeight="bold">Team</Typography>
                    <Typography variant="body1" color="text.secondary">
                        Manage members and permissions.
                    </Typography>
                </Box>
                <Button variant="outlined" startIcon={<AddIcon />} onClick={() => setInviteOpen(true)}>Invite Member</Button>
            </Box>

            <Paper variant="outlined">
                <List disablePadding>
                    {members.map((m, idx) => (
                        <Box key={m.id}>
                            <ListItem
                                sx={{ py: 2, px: 3 }}
                                secondaryAction={
                                    <IconButton edge="end" aria-label="delete" onClick={() => handleRemove(m)}>
                                        <DeleteIcon />
                                    </IconButton>
                                }
                            >
                                <ListItemIcon>
                                    <Avatar sx={{ bgcolor: m.status === 'INVITED' ? 'grey.400' : 'secondary.main' }}>
                                        {m.profile?.preferredName?.[0]?.toUpperCase() || m.inviteEmail?.[0]?.toUpperCase() || 'U'}
                                    </Avatar>
                                </ListItemIcon>
                                <ListItemText
                                    primary={
                                        <Stack direction="row" spacing={1} alignItems="center">
                                            <Typography variant="subtitle1" fontWeight={600}>
                                                {m.profile?.preferredName || m.inviteEmail || 'Unknown User'}
                                            </Typography>
                                            {m.status === 'INVITED' && <Chip label="Invited" size="small" variant="outlined" />}
                                        </Stack>
                                    }
                                    secondary={m.status === 'INVITED' ? 'Pending Acceptance' : (m.profile?.email || m.inviteEmail || 'No email')}
                                />
                                <Chip
                                    label={m.role}
                                    size="small"
                                    color={m.role === 'OWNER' ? 'primary' : 'default'}
                                    variant={m.role === 'OWNER' ? 'filled' : 'outlined'}
                                    sx={{ mr: 2 }}
                                />
                            </ListItem>
                            {idx < members.length - 1 && <Divider />}
                        </Box>
                    ))}
                </List>
            </Paper>

            {/* Invite Dialog */}
            <Dialog open={inviteOpen} onClose={() => setInviteOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle>Invite New Member</DialogTitle>
                <DialogContent>
                    <Box component="div" pt={1} display="flex" flexDirection="column" gap={2}>
                        <TextField
                            label="Email Address"
                            fullWidth
                            value={inviteEmail}
                            onChange={e => setInviteEmail(e.target.value)}
                            placeholder="e.g. jane@example.com"
                        />
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setInviteOpen(false)}>Cancel</Button>
                    <Button onClick={handleInvite} variant="contained" disabled={!inviteEmail || isInviting}>
                        {isInviting ? 'Inviting...' : 'Send Invitation'}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};
