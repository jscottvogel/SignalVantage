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
        const { data: refreshed } = await client.models.StrategicObjective.get({ id: objective.id });

        const sourceObjective = refreshed || objective;

        // Fetch Risks
        const { data: risks } = await sourceObjective.risks();

        // Fetch outcomes
        const { data: outcomesRes } = await sourceObjective.outcomes();

        // Fetch children for each outcome
        const outcomesWithChildren = await Promise.all(
            outcomesRes.map(async (outcome: Schema['Outcome']['type']) => {
                const { data: krs } = await outcome.keyResults();
                return { ...outcome, keyResults: krs };
            })
        );

        // Fetch organization to get context for fetching initiatives
        const { data: org } = await sourceObjective.organization();
        let allInitiatives: Schema['Initiative']['type'][] = [];

        if (org) {
            // Fetch initiatives directly to ensure we get them all
            const { data: inits } = await client.models.Initiative.list({
                filter: { organizationId: { eq: org.id } },
                limit: 1000
            });
            allInitiatives = inits;
        }

        // Map initiatives to KRs and structure the final outcome tree
        const outcomesFinal = outcomesWithChildren.map(outcome => ({
            ...outcome,
            keyResults: outcome.keyResults.map((kr: Schema['KeyResult']['type']) => {
                const linked = allInitiatives.filter(init => {
                    const ids = init.linkedEntities?.keyResultIds || [];
                    return ids.includes(kr.id);
                });
                return {
                    ...kr,
                    initiatives: linked
                };
            })
        }));

        // Fetch Dependencies for all levels
        const allDependencies = await fetchAggregatedDependencies(sourceObjective, outcomesRes, outcomesWithChildren, allInitiatives);

        return {
            refreshedObjective: refreshed,
            risks,
            outcomes: outcomesFinal,
            dependencies: allDependencies,
            allInitiatives // Returning raw list might be useful for other lookups
        };

    } catch (e) {
        logger.error("Error fetching objective hierarchy", e);
        throw e;
    }
}

/**
 * Aggregates dependencies from the Objective and all its child entities.
 * 
 * @param objective - The root objective
 * @param outcomesRes - List of outcomes (raw)
 * @param outcomesWithChildren - List of outcomes with structure (for KRs)
 * @param allInitiatives - List of all initiatives
 * @returns Sorted list of dependencies
 */
async function fetchAggregatedDependencies(
    objective: Schema['StrategicObjective']['type'],
    outcomesRes: Schema['Outcome']['type'][],
    outcomesWithChildren: (Omit<Schema['Outcome']['type'], 'keyResults'> & { keyResults: Schema['KeyResult']['type'][] })[],
    allInitiatives: Schema['Initiative']['type'][]
) {
    // 1. Objective Level
    const { data: objDeps } = await objective.dependencies();

    // 2. Outcome Level
    const outcomeDepsPromises = outcomesRes.map((o) => o.dependencies());
    const outcomeDepsRes = await Promise.all(outcomeDepsPromises);
    const outcomeDeps = outcomeDepsRes.flatMap(r => r.data);

    // 3. Key Result Level
    const allKRs = outcomesWithChildren.flatMap(o => o.keyResults);
    const krDepsPromises = allKRs.map((k) => k.dependencies());
    const krDepsRes = await Promise.all(krDepsPromises);
    const krDeps = krDepsRes.flatMap(r => r.data);

    // 4. Initiative Level
    const initDepsPromises = allInitiatives.map((i) => i.dependencies());
    const initDepsRes = await Promise.all(initDepsPromises);
    const initDeps = initDepsRes.flatMap(r => r.data);

    const allDeps = [...objDeps, ...outcomeDeps, ...krDeps, ...initDeps];

    // Sort by due date
    allDeps.sort((a, b) => {
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    });

    return allDeps;
}
