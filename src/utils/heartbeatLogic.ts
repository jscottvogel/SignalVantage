
import type { Schema } from '../../amplify/data/resource';

type SystemAssessment = Schema['SystemAssessment']['type'];
type OwnerInput = Schema['OwnerInput']['type'];

export const calculateFreshness = (nextHeartbeatDue: string | null | undefined): string => {
    if (!nextHeartbeatDue) return 'ON_TIME';
    const dueDate = new Date(nextHeartbeatDue);
    const now = new Date();
    // Allow 24 hour grace period? Spec says "Late submissions are recorded as a signal".
    return now > dueDate ? 'LATE' : 'ON_TIME';
};

export const assessHeartbeat = (
    ownerInput: OwnerInput,
    previousHeartbeat?: any,
    nextHeartbeatDue?: string | null
): SystemAssessment => {
    const specificity = calculateSpecificity(ownerInput);
    const freshness = calculateFreshness(nextHeartbeatDue);
    const consistency = checkConsistency(ownerInput, previousHeartbeat);

    const confidenceTrend = calculateTrend(ownerInput.ownerConfidence, previousHeartbeat?.ownerInput?.ownerConfidence);

    // Generate FIR
    const facts = [
        `Update submitted with ${ownerInput.newRisks?.length || 0} new risks.`,
        `Owner confidence is ${ownerInput.ownerConfidence}.`
    ];

    const inferences: string[] = [];
    if (specificity === 'VAGUE') inferences.push("Brief update content suggests potential lack of detail or visibility.");
    if (freshness === 'LATE') inferences.push("Update was submitted past the scheduled cadence.");

    // Spec Requirement: "Confidence may never be accepted without rationale."
    // (This should be enforced by UI validation, but we note it here as a fact if missing).
    if (!ownerInput.confidenceRationale) {
        inferences.push("Confidence rationale was missing (Data Quality Issue).");
    }

    const recommendations: string[] = [];
    if (ownerInput.ownerConfidence === 'LOW') recommendations.push("Review risks and consider escalating blockers.");
    if (specificity === 'VAGUE') recommendations.push("Provide more detailed progress metrics in next update.");

    return {
        systemConfidence: ownerInput.ownerConfidence || 'MEDIUM', // "System must never invent certainty" - generally aligns with owner unless conflict
        confidenceTrend,
        integritySignals: {
            updateFreshness: freshness,
            languageSpecificity: specificity,
            signalConsistency: consistency,
        },
        uncertaintyFlags: specificity === 'VAGUE' ? ['Vague Input'] : [],
        factsInferencesRecommendations: {
            facts,
            inferences,
            recommendations
        }
    };
};

const calculateSpecificity = (input: OwnerInput): string => {
    const text = (input.progressSummary || '') + (input.confidenceRationale || '');
    const wordCount = text.split(/\s+/).length;
    if (wordCount < 15) return 'VAGUE';
    if (wordCount < 40) return 'MIXED';
    return 'SPECIFIC';
};

const checkConsistency = (_current: OwnerInput, previous: any): string => {
    if (!previous) return 'ALIGNED';
    // Example logic: specific checks could go here.
    return 'ALIGNED';
};

const calculateTrend = (currentConf?: string | null, prevConf?: string | null): string => {
    const map: Record<string, number> = { 'HIGH': 3, 'MEDIUM': 2, 'LOW': 1 };
    const currVal = map[currentConf || 'MEDIUM'];
    const prevVal = map[prevConf || 'MEDIUM'];

    if (currVal > prevVal) return 'IMPROVING';
    if (currVal < prevVal) return 'DECLINING';
    return 'STABLE';
};

// Key Result Rollup Logic
export const generateKeyResultRollup = (
    initiatives: { confidence: string, title: string, relevance?: string }[]
): { confidence: string, trend: string, summary: string } => {

    if (initiatives.length === 0) {
        return { confidence: 'MEDIUM', trend: 'STABLE', summary: 'No linked initiatives.' };
    }

    const map: Record<string, number> = { 'HIGH': 3, 'MEDIUM': 2, 'LOW': 1 };
    let totalScore = 0;

    // "Weight initiatives by relevance (primary vs supporting)" - assuming we had this data.
    // Spec says: "Primary initiative drivers". 
    // For now simple average, but pulling down if any is LOW is a good safe heuristic.

    let hasLow = false;
    initiatives.forEach(i => {
        if (i.confidence === 'LOW') hasLow = true;
        totalScore += map[i.confidence || 'MEDIUM'];
    });

    const avg = totalScore / initiatives.length;
    let confidence = 'MEDIUM';
    if (avg >= 2.5) confidence = 'HIGH';
    if (hasLow) confidence = 'LOW'; // Conservative rollup rule: "Conflicting signals must reduce confidence"

    const drivers = initiatives.slice(0, 3).map(i => i.title).join(', ');

    return {
        confidence,
        trend: 'STABLE', // Needs history to calculate trend, simplified for now
        summary: `Confidence driven by status of: ${drivers}. Calculated based on ${initiatives.length} initiatives.`
    };
};

export const calculateAttentionLevel = (objective: any): 'STABLE' | 'WATCH' | 'ACTION' => {
    const latestHeartbeat = objective.latestHeartbeat;
    // Handle partial objects or missing heartbeats
    const confidence = latestHeartbeat?.systemAssessment?.systemConfidence ||
        latestHeartbeat?.ownerInput?.ownerConfidence ||
        'MEDIUM';
    const trend = latestHeartbeat?.systemAssessment?.confidenceTrend || 'STABLE';

    let level: 'STABLE' | 'WATCH' | 'ACTION' = 'STABLE';

    if (confidence === 'LOW') level = 'ACTION';
    else if (confidence === 'MEDIUM' && trend === 'DECLINING') level = 'ACTION';
    else if (confidence === 'MEDIUM' && trend === 'STABLE') level = 'WATCH';
    else if (confidence === 'HIGH' && trend === 'DECLINING') level = 'WATCH';

    // Late Heartbeat Check
    if (objective.nextHeartbeatDue) {
        const dueDate = new Date(objective.nextHeartbeatDue);
        if (dueDate < new Date()) {
            // Escalate if stable
            if (level === 'STABLE') level = 'WATCH';
            // Could escalate WATCH to ACTION if very late? For now, WATCH is appropriate for lateness alone.
        }
    }

    return level;
};
