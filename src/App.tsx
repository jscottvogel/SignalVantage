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
  Chip
} from '@mui/material';
import DashboardIcon from '@mui/icons-material/Dashboard';
import GroupIcon from '@mui/icons-material/Group';
import SettingsIcon from '@mui/icons-material/Settings';
import PersonIcon from '@mui/icons-material/Person';
import MenuIcon from '@mui/icons-material/Menu';
import AddIcon from '@mui/icons-material/Add';
import LogoutIcon from '@mui/icons-material/Logout';
import SignalCellularAltIcon from '@mui/icons-material/SignalCellularAlt';

import { StrategicObjectiveCard } from "./components/StrategicObjectiveCard";
import { CreateObjectiveForm } from "./components/CreateObjectiveForm";
import { ObjectiveDetailModal } from "./components/ObjectiveDetailModal";
import { calculateAttentionLevel } from './utils/heartbeatLogic';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';

import { ExecutiveBriefingDrawer } from './components/ExecutiveBriefingDrawer';
import SmartToyIcon from '@mui/icons-material/SmartToy';

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
  // ... other existing imports
} from '@mui/material';

// ... other code

const TeamView = ({ org }: { org: Schema["Organization"]["type"] }) => {
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Invite State
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [isInviting, setIsInviting] = useState(false);

  const fetchMembers = async () => {
    try {
      const { data: membershipList } = await org.members();
      const membersWithProfiles = await Promise.all(
        membershipList.map(async (m) => {
          const { data: profile } = await m.user();
          return { ...m, profile };
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
    if (!inviteName.trim() || !inviteEmail.trim()) return;
    setIsInviting(true);
    try {
      // 1. Create UserProfile
      const { data: profile, errors: profileErrors } = await client.models.UserProfile.create({
        email: inviteEmail,
        preferredName: inviteName
      });
      if (profileErrors) throw new Error(profileErrors[0].message);
      if (!profile) throw new Error("Failed to create profile");

      // 2. Create Membership
      const { errors: memberErrors } = await client.models.Membership.create({
        organizationId: org.id,
        userProfileId: profile.id,
        role: 'MEMBER'
      });
      if (memberErrors) throw new Error(memberErrors[0].message);

      // 3. Refresh
      await fetchMembers();
      setInviteOpen(false);
      setInviteName('');
      setInviteEmail('');
    } catch (e) {
      console.error("Invitation failed", e);
      alert("Failed to invite member. See console.");
    } finally {
      setIsInviting(false);
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
              <ListItem sx={{ py: 2, px: 3 }}>
                <ListItemButton sx={{ borderRadius: 2 }}>
                  <ListItemIcon>
                    <Avatar sx={{ bgcolor: 'secondary.main' }}>
                      {m.profile?.preferredName?.[0]?.toUpperCase() || 'U'}
                    </Avatar>
                  </ListItemIcon>
                  <ListItemText
                    primary={
                      <Typography variant="subtitle1" fontWeight={600}>
                        {m.profile?.preferredName || 'Unknown User'}
                      </Typography>
                    }
                    secondary={m.profile?.email || 'No email'}
                  />
                  <Chip
                    label={m.role}
                    size="small"
                    color={m.role === 'OWNER' ? 'primary' : 'default'}
                    variant={m.role === 'OWNER' ? 'filled' : 'outlined'}
                  />
                </ListItemButton>
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
              label="Full Name"
              fullWidth
              value={inviteName}
              onChange={e => setInviteName(e.target.value)}
              placeholder="e.g. Jane Doe"
            />
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
          <Button onClick={handleInvite} variant="contained" disabled={!inviteName || !inviteEmail || isInviting}>
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
      let userProfile = profiles[0];

      if (!userProfile) {
        console.log("Creating new UserProfile...");
        const { data: newProfile, errors } = await client.models.UserProfile.create({
          email: currentUser?.signInDetails?.loginId || "unknown",
          preferredName: currentUser?.signInDetails?.loginId || "User",
        });
        if (errors) throw new Error(errors[0].message);
        userProfile = newProfile!;
      }

      const { data: memberships } = await userProfile.memberships();

      if (memberships.length > 0) {
        const membership = memberships[0];
        const { data: organization } = await membership.organization();

        if (organization) {
          const { data: objs } = await organization.objectives();
          setObjectives(objs);
          setOrg(organization);
        }
      } else {
        const { data: newOrg, errors: orgErrors } = await client.models.Organization.create({
          name: "My Organization",
        });
        if (orgErrors) throw new Error(orgErrors[0].message);

        const { errors: memErrors } = await client.models.Membership.create({
          role: "OWNER",
          organizationId: newOrg!.id,
          userProfileId: userProfile.id,
        });
        if (memErrors) throw new Error(memErrors[0].message);

        setOrg(newOrg);
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
        return <Paper sx={{ p: 6, textAlign: 'center' }}><Typography color="text.secondary">User profile management coming soon.</Typography></Paper>;
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
                    variant="outlined"
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
    // ...
    <Box display="flex" justifyContent="center" alignItems="center" height="100vh">
      <Typography color="text.secondary">Unable to access workspace. Please contact support.</Typography>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex' }}>
      <CssBaseline />

      {/* Top Bar (Mobile Only for Title, Desktop has header in sidebar usually, but here we keep app bar for breadcrumbs/user mostly on mobile) */}
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

          {/* Breadcrumb-ish title for context */}
          <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1, fontWeight: 'bold' }}>
            {/* Dynamic Title based on View */}
            {org?.name}
          </Typography>

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
