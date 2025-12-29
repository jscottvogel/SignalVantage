import { useState, useEffect } from "react";
import { Authenticator } from "@aws-amplify/ui-react";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "../amplify/data/resource";
import "@aws-amplify/ui-react/styles.css";
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { theme } from './theme';
import {
  Box,
  Drawer,
  AppBar,
  Toolbar,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
  Container,
  Button,
  IconButton,
  Avatar,
  Divider,
  Paper,
  CircularProgress,
  Snackbar,
  Alert,
  Stack,
  Skeleton,
  Chip,
  Menu,
  MenuItem
} from '@mui/material';
import DashboardIcon from '@mui/icons-material/Dashboard';
import GroupIcon from '@mui/icons-material/Group';
import SettingsIcon from '@mui/icons-material/Settings';
import PersonIcon from '@mui/icons-material/Person';
import MenuIcon from '@mui/icons-material/Menu';
import AddIcon from '@mui/icons-material/Add';
import LogoutIcon from '@mui/icons-material/Logout';
import DeleteIcon from '@mui/icons-material/Delete';
import SignalCellularAltIcon from '@mui/icons-material/SignalCellularAlt';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import BusinessIcon from '@mui/icons-material/Business';
import MarkEmailReadIcon from '@mui/icons-material/MarkEmailRead';

import { StrategicObjectiveCard } from "./components/StrategicObjectiveCard";
import { CreateObjectiveForm } from "./components/CreateObjectiveForm";
import { ObjectiveDetailModal } from "./components/ObjectiveDetailModal";
import { calculateAttentionLevel } from './utils/heartbeatLogic';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';

import { ExecutiveBriefingDrawer } from './components/ExecutiveBriefingDrawer';


const client = generateClient<Schema>();

const drawerWidth = 260; // Slightly wider for better breathing room

const SkeletonDashboard = () => (
  <Box>
    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 3 }}>
      {[1, 2, 3].map((i) => (
        <Paper key={i} variant="outlined" sx={{ p: 3, height: 200 }}>
          <Stack spacing={2}>
            <Box display="flex" justifyContent="space-between">
              <Skeleton variant="rounded" width={80} height={24} />
              <Skeleton variant="circular" width={24} height={24} />
            </Box>
            <Skeleton variant="text" width="80%" height={32} />
            <Skeleton variant="text" width="100%" />
            <Skeleton variant="text" width="90%" />
          </Stack>
        </Paper>
      ))}
    </Box>
  </Box>
);

import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
} from '@mui/material';


const ProfileView = ({ userProfile, onProfileUpdate }: { userProfile: any, onProfileUpdate: () => void }) => {
  const [invites, setInvites] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [myOrgs, setMyOrgs] = useState<any[]>([]);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        // Load pending invites
        if (userProfile?.email) {
          const { data: foundInvites } = await client.models.Membership.list({
            filter: {
              inviteEmail: { eq: userProfile.email },
              status: { eq: 'INVITED' }
            }
          });

          // Enrich invites with org data
          const enrichedInvites = await Promise.all(foundInvites.map(async (inv) => {
            const { data: org } = await inv.organization();
            return { ...inv, organization: org };
          }));
          setInvites(enrichedInvites);
        }

        // Load my orgs
        const { data: memberships } = await userProfile.memberships();
        const activeMemberships = await Promise.all(memberships.map(async (m: any) => {
          if (m.status !== 'ACTIVE') return null;
          const { data: org } = await m.organization();
          return { ...m, organization: org };
        }));
        setMyOrgs(activeMemberships.filter(m => m !== null));

      } catch (e) {
        console.error("Error loading profile data", e);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [userProfile]);

  const handleAccept = async (inviteId: string) => {
    try {
      await client.models.Membership.update({
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

      <Typography variant="h6" gutterBottom>My Organizations</Typography>
      <Paper variant="outlined">
        <List>
          {myOrgs.map((m, idx) => (
            <Box key={m.id}>
              <ListItem>
                <ListItemIcon>
                  <BusinessIcon color="action" />
                </ListItemIcon>
                <ListItemText
                  primary={m.organization?.name}
                  secondary={`Role: ${m.role}`}
                />
                {m.role === 'OWNER' && <Chip label="Owner" size="small" color="primary" variant="outlined" />}
              </ListItem>
              {idx < myOrgs.length - 1 && <Divider />}
            </Box>
          ))}
        </List>
      </Paper>
    </Box>
  );
};

const TeamView = ({ org }: { org: Schema["Organization"]["type"] }) => {
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Invite State
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [isInviting, setIsInviting] = useState(false);

  const fetchMembers = async () => {
    try {
      const { data: membershipList } = await org.members();
      const membersWithProfiles = await Promise.all(
        membershipList.map(async (m) => {
          let profile = null;
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
      setMembers(membersWithProfiles);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    if (mounted) fetchMembers();
    return () => { mounted = false; };
  }, [org]);

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return;
    setIsInviting(true);
    try {
      const { errors } = await client.models.Membership.create({
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

  const handleRemove = async (member: any) => {
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
          const targetOwner = { userId: ownerId, displayName: ownerName, role: 'OWNER' };
          const removedUserId = member.userProfileId;

          const { data: objs } = await org.objectives();
          const { data: outcomes } = await org.outcomes();
          const { data: krs } = await org.keyResults();
          const { data: inits } = await org.initiatives();

          const updates: Promise<any>[] = [];

          objs.forEach(o => {
            if (o.owner?.userId === removedUserId) updates.push(client.models.StrategicObjective.update({ id: o.id, owner: targetOwner }));
          });
          outcomes.forEach(o => {
            if (o.owner?.userId === removedUserId) updates.push(client.models.Outcome.update({ id: o.id, owner: targetOwner }));
          });
          krs.forEach(k => {
            if (k.owners?.some((ow: any) => ow?.userId === removedUserId)) {
              const newOwners = k.owners.map((ow: any) => ow.userId === removedUserId ? targetOwner : ow);
              updates.push(client.models.KeyResult.update({ id: k.id, owners: newOwners }));
            }
          });
          inits.forEach(i => {
            if (i.owner?.userId === removedUserId) updates.push(client.models.Initiative.update({ id: i.id, owner: targetOwner }));
          });

          await Promise.all(updates);
        }
      }

      await client.models.Membership.delete({ id: member.id });
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

type ViewState = 'dashboard' | 'team' | 'settings' | 'profile';

function Dashboard({ user, signOut }: { user: any; signOut: ((data?: any) => void) | undefined }) {
  const [org, setOrg] = useState<Schema["Organization"]["type"] | null>(null);
  const [loading, setLoading] = useState(true);
  const [objectives, setObjectives] = useState<Schema["StrategicObjective"]["type"][]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [currentView, setCurrentView] = useState<ViewState>('dashboard');
  const [selectedObjective, setSelectedObjective] = useState<Schema["StrategicObjective"]["type"] | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showBriefing, setShowBriefing] = useState(false);

  // New State for Org Switching & Profile
  const [userProfile, setUserProfile] = useState<Schema["UserProfile"]["type"] | null>(null);
  const [activeMemberships, setActiveMemberships] = useState<any[]>([]);
  const [orgMenuAnchor, setOrgMenuAnchor] = useState<null | HTMLElement>(null);

  // Helper to load org data once ID is known
  const loadOrganization = async (organizationId: string) => {
    try {
      setLoading(true);
      const { data: organization } = await client.models.Organization.get({ id: organizationId });
      if (organization) {
        setOrg(organization);
        const { data: objs } = await organization.objectives();
        setObjectives(objs);
      }
    } catch (e) {
      console.error("Failed to load organization", e);
    } finally {
      setLoading(false);
    }
  };

  const handleOrgSwitch = (orgId: string) => {
    loadOrganization(orgId);
    setOrgMenuAnchor(null);
    setCurrentView('dashboard');
  };

  // Feedback Handling
  const [snackbar, setSnackbar] = useState<{ open: boolean, message: string, severity: 'success' | 'error' | 'info' }>({
    open: false,
    message: '',
    severity: 'success'
  });

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const showSuccess = (msg: string) => {
    setSnackbar({ open: true, message: msg, severity: 'success' });
  };

  const showError = (msg: string) => {
    setSnackbar({ open: true, message: msg, severity: 'error' });
  };

  const checkAndBootstrap = async (currentUser: any) => {
    try {
      setLoading(true);
      const { data: profiles } = await client.models.UserProfile.list();
      let foundProfile = profiles[0];

      if (!foundProfile) {
        console.log("Creating new UserProfile...");
        const { data: newProfile, errors } = await client.models.UserProfile.create({
          email: currentUser?.signInDetails?.loginId || "unknown",
          preferredName: currentUser?.signInDetails?.loginId || "User",
        });
        if (errors) throw new Error(errors[0].message);
        foundProfile = newProfile!;
      }
      setUserProfile(foundProfile);

      // Fetch all memberships
      const { data: memberships } = await foundProfile.memberships();

      // Filter for ACTIVE memberships and enrich with Organization names
      const enriched = await Promise.all(memberships.map(async (m) => {
        if (m.status === 'INVITED') return null; // Skip pending invites here
        try {
          const { data: linkedOrg } = await m.organization();
          return linkedOrg ? { ...m, organization: linkedOrg } : null;
        } catch { return null; }
      }));

      const activeList = enriched.filter(m => m !== null);
      setActiveMemberships(activeList);

      if (activeList.length > 0) {
        // Load the first one by default if not already loaded, OR if current org is not in the list (e.g. removed)
        const currentStillValid = org && activeList.find(m => m.organization.id === org.id);

        if (!org || !currentStillValid) {
          await loadOrganization(activeList[0].organization.id);
        } else {
          // Just refresh data
          if (activeList[0]?.organization?.id) {
            await loadOrganization(activeList[0].organization.id);
          }
        }

      } else {
        let organization = null;
        const email = currentUser?.signInDetails?.loginId;

        // 1. Check for pending invites matching user's email
        if (email) {
          try {
            const { data: invites } = await client.models.Membership.list({
              filter: {
                inviteEmail: { eq: email },
                status: { eq: 'INVITED' }
              }
            });

            if (invites.length > 0) {
              console.log("Found pending invite, accepting...");
              const invite = invites[0];

              // Link profile to membership and activate
              const { data: updatedMember, errors: updateErrors } = await client.models.Membership.update({
                id: invite.id,
                userProfileId: foundProfile.id,
                status: 'ACTIVE'
              });

              if (updateErrors) throw new Error(updateErrors[0].message);

              if (updatedMember) {
                const { data: linkedOrg } = await updatedMember.organization();
                if (linkedOrg) {
                  organization = linkedOrg;
                  showSuccess(`Successfully joined ${linkedOrg.name}`);
                  // Refresh memberships
                  const newMembership = { ...updatedMember, organization: linkedOrg };
                  setActiveMemberships([newMembership]);
                }
              }
            }
          } catch (e) {
            console.warn("Error processing invite:", e);
          }
        }

        // 2. If an organization was found/joined, load it. Otherwise create new.
        if (organization) {
          await loadOrganization(organization.id);
        } else {
          const { data: newOrg, errors: orgErrors } = await client.models.Organization.create({
            name: "My Organization",
          });
          if (orgErrors) throw new Error(orgErrors[0].message);

          const { data: newMem, errors: memErrors } = await client.models.Membership.create({
            role: "OWNER",
            organizationId: newOrg!.id,
            userProfileId: foundProfile.id,
            status: 'ACTIVE'
          });
          if (memErrors) throw new Error(memErrors[0].message);

          setActiveMemberships([{ ...newMem, organization: newOrg }]);
          setOrg(newOrg);
          setObjectives([]); // New org empty
        }
      }
    } catch (e) {
      console.error("Error bootstrapping:", e);
      showError("Failed to load organization data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      checkAndBootstrap(user);
    }
  }, [user?.userId]);

  const drawer = (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Toolbar sx={{ px: 3, minHeight: 70 }}>
        <Stack direction="row" alignItems="center" spacing={1.5}>
          <SignalCellularAltIcon sx={{ color: 'secondary.main', fontSize: 32 }} />
          <Box>
            <Typography variant="h6" color="inherit" fontWeight={700} lineHeight={1.1}>
              VANTAGE
            </Typography>
            <Typography variant="caption" color="grey.500" display="block">
              EXECUTIVE OS
            </Typography>
          </Box>
        </Stack>
      </Toolbar>
      <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)' }} />
      <List sx={{ mt: 2, px: 1 }}>
        {[
          { id: 'dashboard', label: 'Dashboard', icon: <DashboardIcon /> },
          { id: 'team', label: 'Team', icon: <GroupIcon /> },
          { id: 'settings', label: 'Settings', icon: <SettingsIcon /> },
          { id: 'profile', label: 'Profile', icon: <PersonIcon /> },
        ].map((item) => (
          <ListItem key={item.id} disablePadding sx={{ mb: 1 }}>
            <ListItemButton
              selected={currentView === item.id}
              onClick={() => { setCurrentView(item.id as ViewState); setMobileOpen(false); }}
            >
              <ListItemIcon sx={{ color: currentView === item.id ? 'secondary.main' : 'inherit' }}>
                {item.icon}
              </ListItemIcon>
              <ListItemText
                primary={item.label}
                primaryTypographyProps={{
                  fontWeight: currentView === item.id ? 600 : 400,
                  color: currentView === item.id ? 'white' : 'grey.400'
                }}
              />
            </ListItemButton>
          </ListItem>
        ))}
      </List>

      <Box sx={{ flexGrow: 1 }} />
      <Divider sx={{ borderColor: 'rgba(255,255,255,0.08)' }} />
      <List sx={{ px: 1 }}>
        <ListItem disablePadding>
          <ListItemButton onClick={signOut}>
            <ListItemIcon><LogoutIcon /></ListItemIcon>
            <ListItemText primary="Sign Out" />
          </ListItemButton>
        </ListItem>
      </List>

      <Box p={2}>
        <Box sx={{ p: 2, bgcolor: 'rgba(255,255,255,0.03)', borderRadius: 2 }}>
          <Typography variant="caption" color="grey.500" display="block" gutterBottom>
            Logged in as
          </Typography>
          <Typography variant="body2" color="white" noWrap>
            {user?.signInDetails?.loginId || 'User'}
          </Typography>
        </Box>
      </Box>
    </Box>
  );

  const renderContent = () => {
    switch (currentView) {
      case 'team':
        return org ? <TeamView org={org} /> : null;
      case 'settings':
        return <Paper sx={{ p: 6, textAlign: 'center' }}><Typography color="text.secondary">Organization settings coming soon.</Typography></Paper>;
      case 'profile':
        return userProfile ? (
          <ProfileView
            userProfile={userProfile}
            onProfileUpdate={() => checkAndBootstrap(user)}
          />
        ) : <CircularProgress />;
      default:
        const stats = { action: 0, watch: 0, stable: 0 };
        objectives.forEach(obj => {
          const level = calculateAttentionLevel(obj);
          if (level === 'ACTION') stats.action++;
          else if (level === 'WATCH') stats.watch++;
          else stats.stable++;
        });

        return (
          <>
            <Box mb={4}>
              <Box display="flex" justifyContent="space-between" alignItems="flex-end" mb={2}>
                <Box>
                  <Typography variant="h2" gutterBottom>
                    Strategic Objectives
                  </Typography>
                  <Typography variant="body1" color="text.secondary">
                    Executive Overview & Risk Monitoring
                  </Typography>
                </Box>
                <Stack direction="row" spacing={2}>
                  <Button
                    variant="contained"
                    color="secondary"
                    onClick={() => setShowBriefing(true)}
                  >
                    Executive Briefing
                  </Button>
                  <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={() => setShowCreateModal(true)}
                    size="medium"
                  >
                    New Objective
                  </Button>
                </Stack>
              </Box>

              {/* Executive Summary Chips */}
              {!loading && objectives.length > 0 && (
                <Stack direction="row" spacing={2} mt={2}>
                  <Chip
                    icon={<ErrorOutlineIcon />}
                    label={`${stats.action} Action Needed`}
                    color={stats.action > 0 ? "error" : "default"}
                    variant={stats.action > 0 ? "filled" : "outlined"}
                    sx={{ fontWeight: 'bold' }}
                  />
                  <Chip
                    icon={<WarningAmberIcon />}
                    label={`${stats.watch} Watch`}
                    color={stats.watch > 0 ? "warning" : "default"}
                    variant={stats.watch > 0 ? "filled" : "outlined"}
                    sx={{ fontWeight: 'bold' }}
                  />
                  <Chip
                    icon={<CheckCircleOutlineIcon />}
                    label={`${stats.stable} Stable`}
                    color="success"
                    variant="outlined"
                  />
                </Stack>
              )}
            </Box>


            {loading ? (
              <SkeletonDashboard />
            ) : objectives.length === 0 ? (
              <Paper
                variant="outlined"
                sx={{
                  p: 8,
                  textAlign: 'center',
                  borderStyle: 'dashed',
                  borderColor: 'divider',
                  bgcolor: 'background.default'
                }}
              >
                <Stack spacing={2} alignItems="center">
                  <SignalCellularAltIcon sx={{ fontSize: 48, color: 'text.secondary', opacity: 0.5 }} />
                  <Typography variant="h5" color="text.primary" fontWeight={600}>No Strategic Objectives Yet</Typography>
                  <Typography color="text.secondary" maxWidth="sm">
                    Objectives are the highest level of your strategy. They define what your organization ultimately wants to achieve. Start by creating your first one.
                  </Typography>
                  <Box pt={2}>
                    <Button variant="contained" onClick={() => setShowCreateModal(true)}>Create Objective</Button>
                  </Box>
                </Stack>
              </Paper>
            ) : (
              <>
                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 3 }}>
                  {objectives.map(obj => (
                    <Box key={obj.id}>
                      <StrategicObjectiveCard
                        objective={obj}
                        onClick={() => setSelectedObjective(obj)}
                      />
                    </Box>
                  ))}
                </Box>
              </>
            )}

            <ExecutiveBriefingDrawer
              open={showBriefing}
              onClose={() => setShowBriefing(false)}
              objectives={objectives}
            />
          </>
        );
    }
  };

  if (!org && !loading) return (
    <Box sx={{ display: 'flex' }}>
      <CssBaseline />
      <AppBar position="fixed" elevation={0} sx={{ bgcolor: 'background.default', borderBottom: 1, borderColor: 'divider' }}>
        <Toolbar>
          <Typography variant="h6" color="text.primary" fontWeight="bold">VANTAGE</Typography>
          <Box flexGrow={1} />
          <Button onClick={signOut}>Sign Out</Button>
        </Toolbar>
      </AppBar>
      <Box component="main" sx={{ flexGrow: 1, p: 3, mt: 10 }}>
        <Box display="flex" justifyContent="center" alignItems="center" height="60vh" flexDirection="column">
          <CircularProgress size={48} sx={{ mb: 2 }} />
          <Typography color="text.secondary">Loading workspace...</Typography>
        </Box>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex' }}>
      <CssBaseline />

      {/* Top Bar */}
      <AppBar
        position="fixed"
        sx={{
          width: { sm: `calc(100% - ${drawerWidth}px)` },
          ml: { sm: `${drawerWidth}px` },
          bgcolor: 'background.default', // Blend with background
          color: 'text.primary',
          borderBottom: 1,
          borderColor: 'divider',
          boxShadow: 'none',
          backdropFilter: 'blur(8px)',
          backgroundColor: 'rgba(248, 250, 252, 0.8)' // Semi-transparent
        }}
        elevation={0}
      >
        <Toolbar>
          <IconButton
            color="inherit"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2, display: { sm: 'none' } }}
          >
            <MenuIcon />
          </IconButton>

          <Box sx={{ flexGrow: 1 }}>
            <Button
              endIcon={<ExpandMoreIcon />}
              onClick={(e) => setOrgMenuAnchor(e.currentTarget)}
              sx={{
                color: 'text.primary',
                textTransform: 'none',
                fontSize: '1.25rem',
                fontWeight: 700
              }}
            >
              {org?.name || 'Vantage'}
            </Button>
            <Menu
              anchorEl={orgMenuAnchor}
              open={Boolean(orgMenuAnchor)}
              onClose={() => setOrgMenuAnchor(null)}
            >
              {activeMemberships.map(m => (
                <MenuItem key={m.id} onClick={() => handleOrgSwitch(m.organization.id)}>
                  {m.organization.name}
                </MenuItem>
              ))}
            </Menu>
          </Box>

          <Box display="flex" alignItems="center" gap={2}>
            <Button color="inherit" size="small" sx={{ display: { xs: 'none', sm: 'block' } }}>Help</Button>
            <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.main', fontSize: '0.875rem' }}>
              {user?.signInDetails?.loginId?.[0]?.toUpperCase() || 'U'}
            </Avatar>
          </Box>
        </Toolbar>
      </AppBar>

      {/* Navigation Drawer */}
      <Box
        component="nav"
        sx={{ width: { sm: drawerWidth }, flexShrink: { sm: 0 } }}
      >
        {/* Mobile Temporary Drawer */}
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{ keepMounted: true }}
          sx={{
            display: { xs: 'block', sm: 'none' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
          }}
        >
          {drawer}
        </Drawer>
        {/* Desktop Permanent Drawer */}
        <Drawer
          variant="permanent"
          sx={{
            display: { xs: 'none', sm: 'block' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
          }}
          open
        >
          {drawer}
        </Drawer>
      </Box>

      {/* Main Content Area */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          width: { sm: `calc(100% - ${drawerWidth}px)` },
          minHeight: '100vh',
          bgcolor: 'background.default'
        }}
      >
        <Toolbar /> {/* Spacer for AppBar */}
        <Container maxWidth="xl" sx={{ py: 2 }}>
          {loading && !org ? (
            <Box display="flex" justifyContent="center" alignItems="center" height="60vh">
              <CircularProgress />
            </Box>
          ) : (
            renderContent()
          )}
        </Container>
      </Box>

      {/* Global Snackbar */}
      <Snackbar open={snackbar.open} autoHideDuration={6000} onClose={() => setSnackbar({ ...snackbar, open: false })}>
        <Alert onClose={() => setSnackbar({ ...snackbar, open: false })} severity={snackbar.severity} sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>

      {/* Dialogs */}
      {showCreateModal && org && (
        <CreateObjectiveForm
          organizationId={org.id}
          onClose={() => setShowCreateModal(false)}
          onSuccess={(newObj) => {
            setObjectives([...objectives, newObj]);
            showSuccess('Objective created successfully');
          }}
        />
      )}

      {selectedObjective && (
        <ObjectiveDetailModal
          objective={selectedObjective}
          onClose={() => setSelectedObjective(null)}
        />
      )}
    </Box>
  );
}

function App() {
  return (
    <ThemeProvider theme={theme}>
      <Authenticator>
        {({ signOut, user }) => (
          <Dashboard user={user} signOut={signOut} />
        )}
      </Authenticator>
    </ThemeProvider>
  );
}

export default App;
