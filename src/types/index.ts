// src/types/index.ts

// ============ Scraper Types ============

export interface NaverBenefit {
    [key: string]: unknown;
}

export interface NaverProductDetail {
    [key: string]: unknown;
}

export interface NaverResponses {
    benefits: NaverBenefit | NaverBenefit[] | null;
    productDetails: NaverProductDetail | null;
}

export interface ScrapeResult {
    [key: string]: unknown;
}

// ============ Proxy Types ============

export interface ProxyConfig {
    server: string;
    username?: string;
    password?: string;
}

// ============ Fingerprint Types ============

export interface Viewport {
    width: number;
    height: number;
}

export interface BrowserFingerprint {
    userAgent: string;
    viewport: Viewport;
}

// ============ API Response Types ============

export interface ApiSuccessResponse<T = unknown> {
    success: true;
    platform?: string;
    fromCache?: boolean;
    data: T;
    timestamp: string;
    requestId: string;
}

export interface ApiErrorResponse {
    error: string;
    requestId?: string;
}

// ============ Metrics Types ============

export interface MetricsStats {
    totalRequests: number;
    successCount: number;
    errorCount: number;
    totalLatency: number;
    startTime: number;
}

export interface MetricsReport extends MetricsStats {
    avgLatency: number;
    errorRate: number;
    uptime: number;
}

// ============ Logger Types ============

export interface ErrorDetails {
    message: string;
    stack?: string;
    code?: string;
    status?: number;
    data?: unknown;
}
