export interface MetricDefinition {
    category: string;
    name: string;
    unit: string;
    description: string;
}

export const COMMON_METRICS: MetricDefinition[] = [
    // Customer & Growth
    { category: 'Customer & Growth', name: 'Net Promoter Score (NPS)', unit: 'Score', description: 'Customer loyalty and advocacy' },
    { category: 'Customer & Growth', name: 'Customer Satisfaction (CSAT)', unit: 'Score', description: 'Short-term satisfaction' },
    { category: 'Customer & Growth', name: 'Customer Effort Score (CES)', unit: 'Score', description: 'Ease of customer experience' },
    { category: 'Customer & Growth', name: 'Customer Retention Rate', unit: 'Percentage', description: 'Percentage of customers retained' },
    { category: 'Customer & Growth', name: 'Churn Rate', unit: 'Percentage', description: 'Percentage of customers lost' },
    { category: 'Customer & Growth', name: 'Customer Lifetime Value (CLV)', unit: 'Currency', description: 'Long-term customer value' },
    { category: 'Customer & Growth', name: 'Customer Acquisition Cost (CAC)', unit: 'Currency', description: 'Cost to acquire a customer' },

    // Product & Adoption
    { category: 'Product & Adoption', name: 'Monthly Active Users (MAU)', unit: 'Count', description: 'Unique users in a month' },
    { category: 'Product & Adoption', name: 'Daily Active Users (DAU)', unit: 'Count', description: 'Unique users in a day' },
    { category: 'Product & Adoption', name: 'DAU/MAU Ratio', unit: 'Ratio', description: 'Engagement depth' },
    { category: 'Product & Adoption', name: 'Activation Rate', unit: 'Percentage', description: 'Users reaching first value' },
    { category: 'Product & Adoption', name: 'Feature Adoption Rate', unit: 'Percentage', description: 'Users adopting specific features' },
    { category: 'Product & Adoption', name: 'Time to First Value (TTFV)', unit: 'Time', description: 'Time from signup to value' },
    { category: 'Product & Adoption', name: 'Conversion Rate', unit: 'Percentage', description: 'e.g., signup → active user' },

    // Revenue & Financial
    { category: 'Revenue & Financial', name: 'Revenue Growth Rate', unit: 'Percentage', description: 'Rate of revenue increase' },
    { category: 'Revenue & Financial', name: 'Annual Recurring Revenue (ARR)', unit: 'Currency', description: 'Yearly subscription revenue' },
    { category: 'Revenue & Financial', name: 'Monthly Recurring Revenue (MRR)', unit: 'Currency', description: 'Monthly subscription revenue' },
    { category: 'Revenue & Financial', name: 'Average Revenue Per User (ARPU)', unit: 'Currency', description: 'Revenue / Total Users' },
    { category: 'Revenue & Financial', name: 'Gross Margin', unit: 'Percentage', description: 'Revenue minus COGS' },
    { category: 'Revenue & Financial', name: 'Operating Margin', unit: 'Percentage', description: 'Profitability after operations' },
    { category: 'Revenue & Financial', name: 'Return on Investment (ROI)', unit: 'Percentage', description: 'Gain relative to cost' },

    // Operational & Delivery
    { category: 'Operational & Delivery', name: 'On-Time Delivery Rate', unit: 'Percentage', description: 'Projects delivered on time' },
    { category: 'Operational & Delivery', name: 'Cycle Time', unit: 'Time', description: 'Time to complete work item' },
    { category: 'Operational & Delivery', name: 'Throughput', unit: 'Count', description: 'Units completed per time period' },
    { category: 'Operational & Delivery', name: 'Risk Burn-Down', unit: 'Count', description: 'Reduction in identifying risks' },

    // Quality & Reliability
    { category: 'Quality & Reliability', name: 'Defect Rate', unit: 'Percentage', description: 'Defects per unit/release' },
    { category: 'Quality & Reliability', name: 'System Availability (Uptime)', unit: 'Percentage', description: 'Time system is operational' },
    { category: 'Quality & Reliability', name: 'Mean Time to Detect (MTTD)', unit: 'Time', description: 'Average time to identify issue' },
    { category: 'Quality & Reliability', name: 'Mean Time to Recover (MTTR)', unit: 'Time', description: 'Average time to restore service' },

    // People & Execution
    { category: 'People & Execution', name: 'Employee Engagement Score', unit: 'Score', description: 'Internal team sentiment' },
    { category: 'People & Execution', name: 'Attrition Rate', unit: 'Percentage', description: 'Employee turnover' },
    { category: 'People & Execution', name: 'Delivery Predictability', unit: 'Percentage', description: 'Planned vs Actual delivery' },

    // Strategy & Outcome
    { category: 'Strategy & Outcome', name: 'OKR Achievement Rate', unit: 'Percentage', description: 'Objectives met' },
    { category: 'Strategy & Outcome', name: 'Outcome Realization Rate', unit: 'Percentage', description: 'Outcomes achieved' },
    { category: 'Strategy & Outcome', name: 'Strategic Alignment Score', unit: 'Score', description: 'Initiative mapping to strategy' },
];
