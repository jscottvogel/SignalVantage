import { generateClient } from "aws-amplify/data";
import type { Schema } from "../../amplify/data/resource";

const client = generateClient<Schema>();

export interface TelemetryEvent {
    type: 'CLICK' | 'VIEW' | 'SUBMIT' | 'ERROR';
    component: string;
    action: string;
    metadata?: Record<string, any>;
    organizationId?: string;
    userId?: string;
}

/**
 * Logs a User Telemetry event to the backend.
 * Silently catches errors to prevent disrupting the user experience.
 * @param event - The telemetry event to log.
 */
export const logEvent = async (event: TelemetryEvent) => {
    try {
        await client.models.UserTelemetry.create({
            type: event.type,
            component: event.component,
            action: event.action,
            metadata: event.metadata ? JSON.stringify(event.metadata) : undefined,
            timestamp: new Date().toISOString(),
            organizationId: event.organizationId,
            userId: event.userId // Optional if captured by auth context usually, but explicit here
        });
    } catch (e) {
        // Silently fail for telemetry to avoid blocking user flow
        console.warn("Telemetry logging failed:", e);
    }
};

/**
 * Hook or helper to log page views
 */
export const logPageView = (pageName: string, orgId?: string) => {
    logEvent({
        type: 'VIEW',
        component: 'Navigation',
        action: `Viewed ${pageName}`,
        organizationId: orgId
    });
};
