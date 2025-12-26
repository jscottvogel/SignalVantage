import { useState, useEffect } from "react";
import { Authenticator } from "@aws-amplify/ui-react";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "../amplify/data/resource";
import "@aws-amplify/ui-react/styles.css";
import { StrategicObjectiveCard } from "./components/StrategicObjectiveCard";
import { CreateObjectiveForm } from "./components/CreateObjectiveForm";
import { ObjectiveDetailModal } from "./components/ObjectiveDetailModal";
import { UserGroupIcon, Cog6ToothIcon, UserCircleIcon, HomeIcon } from "@heroicons/react/24/outline";

const client = generateClient<Schema>();

type ViewState = 'dashboard' | 'team' | 'settings' | 'profile';

// Internal component to handle the authenticated logic
function Dashboard({ user, signOut }: { user: any; signOut: ((data?: any) => void) | undefined }) {
  const [org, setOrg] = useState<Schema["Organization"]["type"] | null>(null);
  const [loading, setLoading] = useState(true);
  const [objectives, setObjectives] = useState<Schema["StrategicObjective"]["type"][]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [currentView, setCurrentView] = useState<ViewState>('dashboard');
  const [selectedObjective, setSelectedObjective] = useState<Schema["StrategicObjective"]["type"] | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Function to bootstrap User and Org
  const checkAndBootstrap = async (currentUser: any) => {
    try {
      setLoading(true);
      // 1. Check if UserProfile exists
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

      // 2. Check for Memberships
      const { data: memberships } = await userProfile.memberships();

      if (memberships.length > 0) {
        // User has an org, load the first one (assuming single org for now)
        const membership = memberships[0];
        const { data: organization } = await membership.organization();

        if (organization) {
          const { data: objs } = await organization.objectives();
          setObjectives(objs);
          setOrg(organization);
        }
      } else {
        // 3. Create Org and Membership
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

  if (loading) {
    return (
      <main className="layout-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <div style={{ color: 'var(--text-secondary)' }}>Setting up your workspace...</div>
      </main>
    );
  }

  const renderContent = () => {
    switch (currentView) {
      case 'team':
        return <div className="card"><h2>Manage Team</h2><p>Team management interface coming soon.</p></div>;
      case 'settings':
        return <div className="card"><h2>Organization Settings</h2><p>Settings interface coming soon.</p></div>;
      case 'profile':
        return <div className="card"><h2>My Profile</h2><p>Profile management interface coming soon.</p></div>;
      default: // dashboard
        return (
          <section>
            <div className="flex-between mb-4">
              <h2>Strategic Objectives</h2>
              <button onClick={() => setShowCreateModal(true)} className="btn-primary">+ Create New</button>
            </div>

            {objectives.length === 0 ? (
              <div className="card" style={{ textAlign: 'center', padding: '4rem' }}>
                <p className="text-muted" style={{ fontStyle: 'italic', marginBottom: '1.5rem' }}>No strategic objectives yet.</p>
                <button onClick={() => setShowCreateModal(true)} className="btn-primary">Create Your First Objective</button>
              </div>
            ) : (
              <div className="grid-cols-auto">
                {objectives.map(obj => (
                  <StrategicObjectiveCard
                    key={obj.id}
                    objective={obj}
                    onClick={() => setSelectedObjective(obj)}
                  />
                ))}
              </div>
            )}
          </section>
        );
    }
  };



  return (
    <>
      <header className="nav-header">
        <div className="nav-container">
          <div className="nav-brand">
            <h1>{org?.name || "Signal Vantage"}</h1>
          </div>

          <button className="mobile-menu-btn" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
            {mobileMenuOpen ? '✕' : '☰'}
          </button>

          <nav className={`nav-links ${mobileMenuOpen ? 'mobile-open' : ''}`}>
            <button
              onClick={() => { setCurrentView('dashboard'); setMobileMenuOpen(false); }}
              className={`nav-item ${currentView === 'dashboard' ? 'active' : ''}`}
            >
              <HomeIcon style={{ width: '18px' }} /> Dashboard
            </button>
            <button
              onClick={() => { setCurrentView('team'); setMobileMenuOpen(false); }}
              className={`nav-item ${currentView === 'team' ? 'active' : ''}`}
            >
              <UserGroupIcon style={{ width: '18px' }} /> Team
            </button>
            <button
              onClick={() => { setCurrentView('settings'); setMobileMenuOpen(false); }}
              className={`nav-item ${currentView === 'settings' ? 'active' : ''}`}
            >
              <Cog6ToothIcon style={{ width: '18px' }} /> Settings
            </button>
            <button
              onClick={() => { setCurrentView('profile'); setMobileMenuOpen(false); }}
              className={`nav-item ${currentView === 'profile' ? 'active' : ''}`}
            >
              <UserCircleIcon style={{ width: '18px' }} /> Profile
            </button>

            <div style={{ height: '1px', background: 'var(--border-subtle)', margin: '0.5rem 0', display: mobileMenuOpen ? 'block' : 'none' }}></div>

            <button onClick={signOut} className="nav-item">
              Sign Out
            </button>
          </nav>
        </div>
      </header>

      <main className="layout-container">
        {org ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3rem' }}>
            {renderContent()}
          </div>
        ) : (
          <p className="text-muted">No organization found.</p>
        )}

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
      </main>
    </>
  );
}

function App() {
  return (
    <Authenticator>
      {({ signOut, user }) => (
        <Dashboard user={user} signOut={signOut} />
      )}
    </Authenticator>
  );
}

export default App;
