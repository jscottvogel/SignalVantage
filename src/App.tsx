import { useState, useEffect } from "react";
import { Authenticator } from "@aws-amplify/ui-react";
import { generateClient } from "aws-amplify/data";
import type { Schema } from "../amplify/data/resource";
import "@aws-amplify/ui-react/styles.css";

const client = generateClient<Schema>();

// Internal component to handle the authenticated logic
function Dashboard({ user, signOut }: { user: any; signOut: ((data?: any) => void) | undefined }) {
  const [org, setOrg] = useState<Schema["Organization"]["type"] | null>(null);
  const [loading, setLoading] = useState(true);
  const [objectives, setObjectives] = useState<Schema["StrategicObjective"]["type"][]>([]);

  // Function to bootstrap User and Org
  const checkAndBootstrap = async (currentUser: any) => {
    try {
      setLoading(true);
      // 1. Check if UserProfile exists
      // standard owner auth: owner match is based on sub or username depending on config.
      // We'll try to list profiles filtered by owner implicitly or just list and see if we have one.
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
      // We need to fetch memberships for this user.
      // Since we can't filter deeply easily without indexes, we'll list memberships linked to this profile.
      // Actually, we can use the 'memberships' field on the userProfile if we fetch it with selection set,
      // but list() default selection might not include it.
      // Let's use lazy loading or secondary query.

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

  const handleCreateObjective = async () => {
    if (!org) return;
    const title = window.prompt("Enter Strategic Objective Title:");
    if (!title) return; // User cancelled or empty

    try {
      const { data: newObj, errors } = await client.models.StrategicObjective.create({
        title,
        organizationId: org.id
      });
      if (errors) throw new Error(errors[0].message);
      if (newObj) {
        setObjectives([...objectives, newObj]);
      }
    } catch (e) {
      console.error("Error creating objective:", e);
      alert("Failed to create objective");
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
        <div style={{ width: '100%', maxWidth: '1200px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>

          {/* Strategic Objectives Section */}
          <div className="card" style={{ gridColumn: '1 / -1' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2>Strategic Objectives</h2>
              <button onClick={handleCreateObjective}>+ Create</button>
            </div>
            {objectives.length === 0 ? (
              <p style={{ fontStyle: 'italic' }}>No strategic objectives yet. Create one to get started.</p>
            ) : (
              <ul style={{ listStyle: 'none', padding: 0 }}>
                {objectives.map(obj => (
                  <li key={obj.id} style={{ padding: '0.5rem 0', borderBottom: '1px solid var(--border-color)' }}>
                    {obj.title}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Quick Actions */}
          <div className="card">
            <h2>Manage Team</h2>
            <p>View and manage your team members.</p>
            <button onClick={() => alert("Manage Team - Coming Soon")} style={{ width: '100%', marginTop: '1rem' }}>Manage Team</button>
          </div>

          <div className="card">
            <h2>Settings</h2>
            <p>Update organization settings and preferences.</p>
            <button onClick={() => alert("Settings - Coming Soon")} style={{ width: '100%', marginTop: '1rem' }}>Manage Settings</button>
          </div>

          <div className="card">
            <h2>Profile</h2>
            <p>Update your personal profile information.</p>
            <button onClick={() => alert("Profile - Coming Soon")} style={{ width: '100%', marginTop: '1rem' }}>Manage Profile</button>
          </div>

        </div>
      ) : (
        <p>No organization found.</p>
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
