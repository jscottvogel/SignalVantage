import { useState, useEffect, useCallback, useRef } from "react";
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
import SignalCellularAltIcon from '@mui/icons-material/SignalCellularAlt';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

import { StrategicObjectiveCard } from "./components/StrategicObjectiveCard";
import { CreateObjectiveForm } from "./components/CreateObjectiveForm";
import { ObjectiveDetailModal } from "./components/ObjectiveDetailModal";
import { ProfileView } from "./components/ProfileView";
import { TeamView } from "./components/TeamView";
import { calculateAttentionLevel } from './utils/heartbeatLogic';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';

import { ExecutiveBriefingDrawer } from './components/ExecutiveBriefingDrawer';
import { CreateOrganizationWizard } from "./components/CreateOrganizationWizard";
import { SettingsView } from "./components/SettingsView";
import { logPageView } from "./utils/telemetry";


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

type ViewState = 'dashboard' | 'team' | 'settings' | 'profile';


interface AuthUser {
  signInDetails?: {
    loginId?: string;
  };
  userId?: string;
  username?: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function Dashboard({ user, signOut }: { user: AuthUser | undefined; signOut: ((data?: any) => void) | undefined }) {
  const [org, setOrg] = useState<Schema["Organization"]["type"] | null>(null);
  const [loading, setLoading] = useState(true);
  const [objectives, setObjectives] = useState<Schema["StrategicObjective"]["type"][]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [currentView, setCurrentView] = useState<ViewState>('dashboard');
  const [selectedObjective, setSelectedObjective] = useState<Schema["StrategicObjective"]["type"] | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showBriefing, setShowBriefing] = useState(false);
  const [showCreateOrgWizard, setShowCreateOrgWizard] = useState(false);

  // New State for Org Switching & Profile
  const [userProfile, setUserProfile] = useState<Schema["UserProfile"]["type"] | null>(null);
  const [activeMemberships, setActiveMemberships] = useState<(Schema["Membership"]["type"] & { organization: Schema["Organization"]["type"] })[]>([]);
  const [orgMenuAnchor, setOrgMenuAnchor] = useState<null | HTMLElement>(null);
  const orgRef = useRef<Schema["Organization"]["type"] | null>(null);

  useEffect(() => {
    orgRef.current = org;
  }, [org]);

  // Helper to load org data once ID is known
  // Helper to load org data once ID is known
  const loadOrganization = useCallback(async (organizationId: string) => {
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
  }, []);

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

  const checkAndBootstrap = useCallback(async (currentUser: AuthUser) => {
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
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          return linkedOrg ? ({ ...m, organization: linkedOrg } as any) : null;
        } catch { return null; }
      }));

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const activeList = enriched.filter(m => m !== null) as any[];
      setActiveMemberships(activeList);

      if (activeList.length > 0) {
        // Load the first one by default if not already loaded, OR if current org is not in the list (e.g. removed)
        const currentOrg = orgRef.current;
        const currentStillValid = currentOrg && activeList.find(m => m.organization.id === currentOrg.id);

        if (!currentOrg || !currentStillValid) {
          await loadOrganization(activeList[0].organization.id);
        } else {
          // Just refresh data
          if (activeList[0]?.organization?.id) {
            await loadOrganization(activeList[0].organization.id);
          }
        }

      } else {
        // No active memberships found. 
        // 1. Check for pending invites matching user's email
        const email = currentUser?.signInDetails?.loginId;
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
                  // Link Success
                  setOrg(linkedOrg);
                  const { data: objs } = await linkedOrg.objectives();
                  setObjectives(objs);

                  showSuccess(`Successfully joined ${linkedOrg.name}`);
                  // Refresh memberships
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  const newMembership = { ...updatedMember, organization: linkedOrg } as any;
                  setActiveMemberships([newMembership]);
                }
              }
            } else {
              // No invites, and no active memberships. 
              // Do NOT create default org. User is in "no org" state.
              setOrg(null);
              setObjectives([]);
            }
          } catch (e) {
            console.warn("Error processing invite:", e);
          }
        }
      }
    } catch (e) {
      console.error("Error bootstrapping:", e);
      showError("Failed to load organization data.");
    } finally {
      setLoading(false);
    }
  }, [loadOrganization]);

  useEffect(() => {
    if (user) {
      checkAndBootstrap(user);
    }
  }, [user, checkAndBootstrap]);

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
              onClick={() => {
                setCurrentView(item.id as ViewState);
                setMobileOpen(false);
                logPageView(item.label, org?.id);
              }}
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
        return org && userProfile ? (
          <SettingsView
            org={org}
            userProfile={userProfile}
            onUpdateProfile={() => user && checkAndBootstrap(user)}
          />
        ) : <CircularProgress />;
      case 'profile':
        return userProfile ? (
          <ProfileView
            userProfile={userProfile}
            onProfileUpdate={() => user && checkAndBootstrap(user)}
            onCreateOrganization={() => setShowCreateOrgWizard(true)}
          />
        ) : <CircularProgress />;
      default: {
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
              organizationId={org?.id}
            />
          </>
        );
      }
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
        {userProfile ? (
          <Container maxWidth="sm">
            <Paper sx={{ p: 4, textAlign: 'center' }}>
              <Typography variant="h4" gutterBottom>Welcome to Vantage</Typography>
              <Typography color="text.secondary" paragraph>
                You are not currently a member of any organization.
              </Typography>
              <Typography color="text.secondary" paragraph>
                To get started, you can create a new organization or ask an administrator to invite you to an existing one.
              </Typography>
              <Box mt={3}>
                <Button
                  variant="contained"
                  size="large"
                  onClick={() => setShowCreateOrgWizard(true)}
                >
                  Create New Organization
                </Button>
              </Box>
            </Paper>
            <CreateOrganizationWizard
              open={showCreateOrgWizard}
              onClose={() => setShowCreateOrgWizard(false)}
              userProfile={userProfile}
              onSuccess={(newOrg, newMem) => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const enrichedMem = { ...newMem, organization: newOrg } as any;
                setActiveMemberships([enrichedMem]);
                setOrg(newOrg);
                setObjectives([]);
                showSuccess(`Organization "${newOrg.name}" created!`);
              }}
            />
          </Container>
        ) : (
          <Box display="flex" justifyContent="center" alignItems="center" height="60vh" flexDirection="column">
            <CircularProgress size={48} sx={{ mb: 2 }} />
            <Typography color="text.secondary">Loading workspace...</Typography>
          </Box>
        )}
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
              <Divider />
              <MenuItem onClick={() => { setOrgMenuAnchor(null); setShowCreateOrgWizard(true); }}>
                <ListItemIcon><AddIcon fontSize="small" /></ListItemIcon>
                <ListItemText>Create New Organization</ListItemText>
              </MenuItem>
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
      {showCreateModal && org && userProfile && (
        <CreateObjectiveForm
          organizationId={org.id}
          userProfile={userProfile!}
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
          onClose={() => {
            setSelectedObjective(null);
            if (org) loadOrganization(org.id);
          }}
        />
      )}

      {userProfile && (
        <CreateOrganizationWizard
          open={showCreateOrgWizard}
          onClose={() => setShowCreateOrgWizard(false)}
          userProfile={userProfile}
          onSuccess={(newOrg, newMem) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const enrichedMem = { ...newMem, organization: newOrg } as any;
            setActiveMemberships([...activeMemberships, enrichedMem]);
            setOrg(newOrg);
            setObjectives([]); // Switching to new empty org
            showSuccess(`Organization "${newOrg.name}" created!`);
          }}
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
