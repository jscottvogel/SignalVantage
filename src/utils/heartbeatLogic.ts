
import type { Schema } from '../../amplify/data/resource';

type SystemAssessment = Schema['SystemAssessment']['type'];
type OwnerInput = Schema['OwnerInput']['type'];

/**
 * Determines if a heartbeat is late based on its due date.
 * @param nextHeartbeatDue - The ISO string date when the next heartbeat is/was due.
 * @returns 'LATE' if the current time is past the due date, otherwise 'ON_TIME'.
 */
export const calculateFreshness = (nextHeartbeatDue: string | null | undefined): string => {
    if (!nextHeartbeatDue) return 'ON_TIME';
    const dueDate = new Date(nextHeartbeatDue);
    const now = new Date();
    // Allow 24 hour grace period? Spec says "Late submissions are recorded as a signal".
    return now > dueDate ? 'LATE' : 'ON_TIME';
};

/**
 * Assess a heartbeat input to generate system confidence, trend, and integrity signals.
 * @param ownerInput - The input provided by the owner (confidence, summary, etc.).
 * @param previousHeartbeat - The previous heartbeat record for comparison (optional).
 * @param nextHeartbeatDue - The due date for the next heartbeat (optional).
 * @returns A SystemAssessment object containing calculated confidence, trend, and signals.
 */
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
    const rawConf: any = ownerInput.ownerConfidence;
    const confVal = typeof rawConf === 'number' ? rawConf : (rawConf === 'HIGH' ? 100 : rawConf === 'MEDIUM' ? 70 : 30);

    if (confVal < 40) recommendations.push("Review risks and consider escalating blockers.");
    if (specificity === 'VAGUE') recommendations.push("Provide more detailed progress metrics in next update.");

    return {
        systemConfidence: ownerInput.ownerConfidence || 50, // Default to 50 if missing
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

const calculateTrend = (currentConf?: number | null, prevConf?: number | null): string => {
    // If we receive strings (legacy data), perform quick mapping or treat as 50
    const parse = (c: any) => {
        if (typeof c === 'number') return c;
        if (c === 'HIGH') return 90;
        if (c === 'MEDIUM') return 70;
        if (c === 'LOW') return 30;
        return 50;
    };

    const currVal = parse(currentConf);
    const prevVal = parse(prevConf);

    if (currVal > prevVal + 5) return 'IMPROVING'; // 5 point buffer
    if (currVal < prevVal - 5) return 'DECLINING';
    return 'STABLE';
};

// Key Result Rollup Logic
// Key Result Rollup Logic
/**
 * Rolls up confidence scores from initiatives to a parent Key Result.
 * @param initiatives - Array of initiatives containing confidence and title.
 * @returns A rollup object with calculated confidence, trend, and summary.
 */
export const generateKeyResultRollup = (
    initiatives: { confidence: number | string, title: string, relevance?: string }[]
): { confidence: number, trend: string, summary: string } => {

    if (initiatives.length === 0) {
        return { confidence: 50, trend: 'STABLE', summary: 'No linked initiatives.' };
    }

    let totalScore = 0;
    let hasLow = false;

    initiatives.forEach(i => {
        let val = 50;
        if (typeof i.confidence === 'number') val = i.confidence;
        else {
            if (i.confidence === 'HIGH') val = 90;
            else if (i.confidence === 'MEDIUM') val = 70;
            else if (i.confidence === 'LOW') val = 30;
        }

        if (val < 40) hasLow = true;
        totalScore += val;
    });

    let avg = totalScore / initiatives.length;

    // Conservative rollup rule: "Conflicting signals must reduce confidence"
    // If any initiative is critically low (<40), cap the rollup at 60 (Watch/Warning)
    if (hasLow && avg > 60) avg = 60;

    const drivers = initiatives.slice(0, 3).map(i => i.title).join(', ');

    return {
        confidence: Math.round(avg),
        trend: 'STABLE', // Needs history to calculate trend, simplified for now
        summary: `Confidence driven by status of: ${drivers}. Calculated based on ${initiatives.length} initiatives.`
    };
};

/**
 * Calculates the attention level for an objective based on its latest heartbeat and due date.
 * @param objective - The objective object containing latestHeartbeat and nextHeartbeatDue.
 * @returns 'ACTION', 'WATCH', or 'STABLE' indicating the attention level.
 */
export const calculateAttentionLevel = (objective: any): 'STABLE' | 'WATCH' | 'ACTION' => {
    const latestHeartbeat = objective.latestHeartbeat;
    // Handle partial objects or missing heartbeats
    const rawConf = latestHeartbeat?.systemAssessment?.systemConfidence || latestHeartbeat?.ownerInput?.ownerConfidence;

    let confidence = 50;
    if (typeof rawConf === 'number') confidence = rawConf;
    else if (rawConf === 'HIGH') confidence = 90;
    else if (rawConf === 'LOW') confidence = 30;
    else confidence = 70; // Medium or undefined

    const trend = latestHeartbeat?.systemAssessment?.confidenceTrend || 'STABLE';

    let level: 'STABLE' | 'WATCH' | 'ACTION' = 'STABLE';

    if (confidence < 50) level = 'ACTION';
    else if (confidence < 75 && trend === 'DECLINING') level = 'ACTION';
    else if (confidence < 75) level = 'WATCH';
    else if (confidence >= 75 && trend === 'DECLINING') level = 'WATCH';
    // Else Stable (>75 and Stable/Improving)

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
