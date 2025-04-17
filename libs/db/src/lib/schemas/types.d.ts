export declare type AccumulatorOperator = '$addToSet' | '$avg' | '$count' | '$first' | '$last' | '$max' | '$mergeObjects' | '$min' | '$push' | '$sum';
export interface GscSearchTermMetrics {
    term: string;
    clicks: number;
    ctr: number;
    impressions: number;
    position: number;
}
