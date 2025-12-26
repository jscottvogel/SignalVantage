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
        setOrg(organization);
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
      <h1>Organization Dashboard</h1>
      {org ? (
        <div className="card">
          <h2>{org.name}</h2>
          <p>Welcome, Owner.</p>
        </div>
      ) : (
        <p>No organization found.</p>
      )}
      <button onClick={signOut}>Sign out</button>
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
