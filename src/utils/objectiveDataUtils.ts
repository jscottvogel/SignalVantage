import { generateClient } from 'aws-amplify/data';
import { type Schema } from '../../amplify/data/resource';
import { logger } from './logger';

type Client = ReturnType<typeof generateClient<Schema>>;

/**
 * Fetches all child data related to a Strategic Objective including
 * Risks, Outcomes, Key Results, Initiatives, and Dependencies.
 * 
 * @param client - The Amplify Data client
 * @param objective - The strategic objective to fetch data for
 * @returns An object containing aggregated data
 */
export async function fetchObjectiveHierarchy(client: Client, objective: Schema['StrategicObjective']['type']) {
    try {
        // Refresh main object
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: refreshed } = await (client.models.StrategicObjective as any).get({ id: objective.id });
        const sourceObjective = refreshed || objective;

        // Fetch Org context for proper Initiative scoping
        const { data: org } = await sourceObjective.organization();
        let allInitiativesRaw: Schema['Initiative']['type'][] = [];

        if (org) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const { data: inits } = await (client.models.Initiative as any).list({
                filter: { organizationId: { eq: org.id } },
                limit: 1000
            });
            allInitiativesRaw = inits;
        }

        // Fetch Outcomes
        const { data: outcomesRes } = await sourceObjective.outcomes();

        // Build the Tree with Dependencies & Risks attached
        const outcomesFinal = await Promise.all(outcomesRes.map(async (outcome: Schema['Outcome']['type']) => {
            const { data: outcomeDeps } = await outcome.dependencies();
            const { data: outcomeRisks } = await outcome.risks();
            const { data: krs } = await outcome.keyResults();

            const krsEnriched = await Promise.all(krs.map(async (kr: Schema['KeyResult']['type']) => {
                const { data: krDeps } = await kr.dependencies();
                const { data: krRisks } = await kr.risks();

                // Find linked initiatives
                const linkedInits = allInitiativesRaw.filter(init => {
                    const ids = init.linkedEntities?.keyResultIds || [];
                    return ids.includes(kr.id);
                });

                // Enrich initiatives
                const initsEnriched = await Promise.all(linkedInits.map(async (init) => {
                    const { data: iDeps } = await init.dependencies();
                    const { data: iRisks } = await init.risks();
                    return { ...init, dependencies: iDeps, risks: iRisks };
                }));

                return { ...kr, initiatives: initsEnriched, dependencies: krDeps, risks: krRisks };
            }));

            return { ...outcome, keyResults: krsEnriched, dependencies: outcomeDeps, risks: outcomeRisks };
        }));

        // Fetch Objective Level Data
        const { data: objDeps } = await sourceObjective.dependencies();
        const { data: objRisks } = await sourceObjective.risks();

        // Aggregation for Summary / Legacy Global View
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let allDeps: any[] = [...objDeps];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let allRisks: any[] = [...objRisks];

        outcomesFinal.forEach(o => {
            allDeps = allDeps.concat(o.dependencies);
            allRisks = allRisks.concat(o.risks);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            o.keyResults.forEach((k: any) => {
                allDeps = allDeps.concat(k.dependencies);
                allRisks = allRisks.concat(k.risks);
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                k.initiatives.forEach((i: any) => {
                    allDeps = allDeps.concat(i.dependencies);
                    allRisks = allRisks.concat(i.risks);
                });
            });
        });

        //Sort Global Dependencies
        allDeps.sort((a, b) => {
            if (!a.dueDate) return 1;
            if (!b.dueDate) return -1;
            return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
        });

        return {
            refreshedObjective: refreshed,
            risks: allRisks,
            outcomes: outcomesFinal,
            dependencies: allDeps,
            allInitiatives: allInitiativesRaw
        };

    } catch (e) {
        logger.error("Error fetching objective hierarchy", e);
        throw e;
    }
}
