import { useState, useEffect } from "react";
import { Authenticator } from "@aws-amplify/ui-react";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "../amplify/data/resource";
import "@aws-amplify/ui-react/styles.css";
import { StrategicObjectiveCard } from "./components/StrategicObjectiveCard";
import { CreateObjectiveForm } from "./components/CreateObjectiveForm";

const client = generateClient<Schema>();

// Internal component to handle the authenticated logic
function Dashboard({ user, signOut }: { user: any; signOut: ((data?: any) => void) | undefined }) {
  const [org, setOrg] = useState<Schema["Organization"]["type"] | null>(null);
  const [loading, setLoading] = useState(true);
  const [objectives, setObjectives] = useState<Schema["StrategicObjective"]["type"][]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);

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
      <main>
        <div>Setting up your workspace...</div>
      </main>
    );
  }

  return (
    <main>
      <header style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', maxWidth: '1200px' }}>
        <h1 style={{ margin: 0, fontSize: '1.5rem', textAlign: 'left' }}>{org?.name || "Organization"} Dashboard</h1>
        <button onClick={signOut} style={{ fontSize: '0.9rem', padding: '0.5rem 1rem' }}>Sign Out</button>
      </header>

      {org ? (
        <div style={{ width: '100%', maxWidth: '1200px', display: 'flex', flexDirection: 'column', gap: '2rem' }}>

          <section>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2>Strategic Objectives</h2>
              <button onClick={() => setShowCreateModal(true)}>+ Create New</button>
            </div>

            {objectives.length === 0 ? (
              <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
                <p style={{ fontStyle: 'italic', marginBottom: '1rem' }}>No strategic objectives yet.</p>
                <button onClick={() => setShowCreateModal(true)}>Create Your First Objective</button>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
                {objectives.map(obj => (
                  <StrategicObjectiveCard key={obj.id} objective={obj} />
                ))}
              </div>
            )}
          </section>

          <section>
            <h2 style={{ marginBottom: '1rem' }}>Manage</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.5rem' }}>
              <div className="card">
                <h3>Team</h3>
                <p>View and manage your team members.</p>
                <button onClick={() => alert("Manage Team - Coming Soon")} style={{ width: '100%', marginTop: '1rem' }}>Manage Team</button>
              </div>

              <div className="card">
                <h3>Settings</h3>
                <p>Update organization settings.</p>
                <button onClick={() => alert("Settings - Coming Soon")} style={{ width: '100%', marginTop: '1rem' }}>Manage Settings</button>
              </div>

              <div className="card">
                <h3>Profile</h3>
                <p>Update your personal profile.</p>
                <button onClick={() => alert("Profile - Coming Soon")} style={{ width: '100%', marginTop: '1rem' }}>Manage Profile</button>
              </div>
            </div>
          </section>

        </div>
      ) : (
        <p>No organization found.</p>
      )}

      {showCreateModal && org && (
        <CreateObjectiveForm
          organizationId={org.id}
          onClose={() => setShowCreateModal(false)}
          onSuccess={(newObj) => setObjectives([...objectives, newObj])}
        />
      )}
    </main>
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
