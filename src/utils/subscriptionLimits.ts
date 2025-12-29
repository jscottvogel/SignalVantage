export type SubscriptionTier = 'FREE' | 'BASIC' | 'PREMIUM';

export interface TierLimits {
    maxOrganizations: number;
    maxObjectives: number;
    maxOutcomesPerObjective: number;
    maxKeyResultsPerOutcome: number;
    maxInitiativesPerKeyResult: number;
    price: number;
    label: string;
}

export const SUBSCRIPTION_LIMITS: Record<SubscriptionTier, TierLimits> = {
    FREE: {
        maxOrganizations: 1,
        maxObjectives: 2,
        maxOutcomesPerObjective: 2,
        maxKeyResultsPerOutcome: 2,
        maxInitiativesPerKeyResult: 2,
        price: 0,
        label: "Free Tier"
    },
    BASIC: {
        maxOrganizations: 2,
        maxObjectives: 5,
        maxOutcomesPerObjective: 5,
        maxKeyResultsPerOutcome: 5,
        maxInitiativesPerKeyResult: 5,
        price: 10,
        label: "Basic Tier"
    },
    PREMIUM: {
        maxOrganizations: 10,
        maxObjectives: 10,
        maxOutcomesPerObjective: 10,
        maxKeyResultsPerOutcome: 10,
        maxInitiativesPerKeyResult: 10,
        price: 25,
        label: "Premium Tier"
    }
};

export const checkLimit = (currentCount: number, limit: number): boolean => {
    return currentCount < limit;
};
