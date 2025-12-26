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
  CircularProgress
} from '@mui/material';
import DashboardIcon from '@mui/icons-material/Dashboard';
import GroupIcon from '@mui/icons-material/Group';
import SettingsIcon from '@mui/icons-material/Settings';
import PersonIcon from '@mui/icons-material/Person';
import MenuIcon from '@mui/icons-material/Menu';
import AddIcon from '@mui/icons-material/Add';
import LogoutIcon from '@mui/icons-material/Logout';

import { StrategicObjectiveCard } from "./components/StrategicObjectiveCard";
import { CreateObjectiveForm } from "./components/CreateObjectiveForm";
import { ObjectiveDetailModal } from "./components/ObjectiveDetailModal";

const client = generateClient<Schema>();

const drawerWidth = 240;

type ViewState = 'dashboard' | 'team' | 'settings' | 'profile';

function Dashboard({ user, signOut }: { user: any; signOut: ((data?: any) => void) | undefined }) {
  const [org, setOrg] = useState<Schema["Organization"]["type"] | null>(null);
  const [loading, setLoading] = useState(true);
  const [objectives, setObjectives] = useState<Schema["StrategicObjective"]["type"][]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [currentView, setCurrentView] = useState<ViewState>('dashboard');
  const [selectedObjective, setSelectedObjective] = useState<Schema["StrategicObjective"]["type"] | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
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
        console.log("Creating Default Organization...");
        const { data: newOrg, errors: orgErrors } = await client.models.Organization.create({
          name: "My Org",
        });
        if (orgErrors) throw new Error(orgErrors[0].message);

        console.log("Creating Owner Membership...");
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
    <div>
      <Toolbar sx={{ justifyContent: 'center' }}>
        <Typography variant="h6" color="primary" fontWeight="bold" sx={{ letterSpacing: 1 }}>
          VANTAGE
        </Typography>
      </Toolbar>
      <Divider />
      <List sx={{ mt: 2 }}>
        <ListItem disablePadding>
          <ListItemButton selected={currentView === 'dashboard'} onClick={() => setCurrentView('dashboard')}>
            <ListItemIcon><DashboardIcon color={currentView === 'dashboard' ? 'primary' : 'inherit'} /></ListItemIcon>
            <ListItemText primary="Dashboard" primaryTypographyProps={{ fontWeight: currentView === 'dashboard' ? 600 : 400 }} />
          </ListItemButton>
        </ListItem>
        <ListItem disablePadding>
          <ListItemButton selected={currentView === 'team'} onClick={() => setCurrentView('team')}>
            <ListItemIcon><GroupIcon color={currentView === 'team' ? 'primary' : 'inherit'} /></ListItemIcon>
            <ListItemText primary="Team" />
          </ListItemButton>
        </ListItem>
        <ListItem disablePadding>
          <ListItemButton selected={currentView === 'settings'} onClick={() => setCurrentView('settings')}>
            <ListItemIcon><SettingsIcon color={currentView === 'settings' ? 'primary' : 'inherit'} /></ListItemIcon>
            <ListItemText primary="Settings" />
          </ListItemButton>
        </ListItem>
        <ListItem disablePadding>
          <ListItemButton selected={currentView === 'profile'} onClick={() => setCurrentView('profile')}>
            <ListItemIcon><PersonIcon color={currentView === 'profile' ? 'primary' : 'inherit'} /></ListItemIcon>
            <ListItemText primary="Profile" />
          </ListItemButton>
        </ListItem>
      </List>

      <Box sx={{ flexGrow: 1 }} />
      <Divider />
      <List>
        <ListItem disablePadding>
          <ListItemButton onClick={signOut}>
            <ListItemIcon><LogoutIcon /></ListItemIcon>
            <ListItemText primary="Sign Out" />
          </ListItemButton>
        </ListItem>
      </List>
    </div>
  );

  const renderContent = () => {
    switch (currentView) {
      case 'team':
        return <Paper sx={{ p: 4, textAlign: 'center' }}><Typography>Team management coming soon.</Typography></Paper>;
      case 'settings':
        return <Paper sx={{ p: 4, textAlign: 'center' }}><Typography>Settings coming soon.</Typography></Paper>;
      case 'profile':
        return <Paper sx={{ p: 4, textAlign: 'center' }}><Typography>Profile management coming soon.</Typography></Paper>;
      default:
        return (
          <>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={4}>
              <Typography variant="h4" component="h1" fontWeight="bold" color="text.primary">
                Strategic Objectives
              </Typography>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => setShowCreateModal(true)}
                size="large"
              >
                Create New
              </Button>
            </Box>

            {loading ? (
              <Box display="flex" justifyContent="center" p={8}><CircularProgress /></Box>
            ) : objectives.length === 0 ? (
              <Paper sx={{ p: 8, textAlign: 'center', borderStyle: 'dashed' }}>
                <Typography variant="h6" color="text.secondary" gutterBottom>No Strategic Objectives Yet</Typography>
                <Typography color="text.secondary" mb={4}>Start by defining what your organization wants to achieve.</Typography>
                <Button variant="outlined" onClick={() => setShowCreateModal(true)}>Create First Objective</Button>
              </Paper>
            ) : (
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 3 }}>
                {objectives.map(obj => (
                  <Box key={obj.id}>
                    <StrategicObjectiveCard
                      objective={obj}
                      onClick={() => setSelectedObjective(obj)}
                    />
                  </Box>
                ))}
              </Box>
            )}
          </>
        );
    }
  };

  if (!org && !loading) return <Box p={4} textAlign="center"><Typography>No organization found.</Typography></Box>;

  return (
    <Box sx={{ display: 'flex' }}>
      <CssBaseline />

      {/* Top Bar for Mobile Menu & Context */}
      <AppBar
        position="fixed"
        sx={{
          width: { sm: `calc(100% - ${drawerWidth}px)` },
          ml: { sm: `${drawerWidth}px` },
        }}
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
          <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1, fontWeight: 'bold' }}>
            {org ? org.name : 'Signal Vantage'}
          </Typography>
          <Box display="flex" alignItems="center" p={1}>
            <Avatar sx={{ width: 32, height: 32, bgcolor: 'secondary.main', fontSize: '0.875rem' }}>
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
          ModalProps={{
            keepMounted: true, // Better open performance on mobile
          }}
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
        sx={{ flexGrow: 1, p: 3, width: { sm: `calc(100% - ${drawerWidth}px)` }, minHeight: '100vh', bgcolor: 'background.default' }}
      >
        <Toolbar /> {/* Spacer for AppBar */}
        <Container maxWidth="xl">
          {loading && !org ? (
            <Box display="flex" justifyContent="center" alignItems="center" height="60vh">
              <CircularProgress />
            </Box>
          ) : (
            renderContent()
          )}
        </Container>
      </Box>

      {/* Dialogs */}
      {showCreateModal && org && (
        <CreateObjectiveForm
          organizationId={org.id}
          onClose={() => setShowCreateModal(false)}
          onSuccess={(newObj) => setObjectives([...objectives, newObj])}
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
