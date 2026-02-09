# Naver SmartStore Scraper API

A professional, scalable, and undetectable REST API built with Node.js and TypeScript to scrape product details from Naver SmartStore. Optimized for high performance, stealth, and rolling proxy management.

## 🚀 Features

- **Deep Scraping**: Direct JSON interception from internal Naver APIs.
- **Turbo organic Mode**: Optimized for **< 6s latency** with snap-scrolling and resource blocking (no images/ads).
- **Rolling Proxy System**: 
  - Supports multiple proxies in `.env`.
  - Automatic health checks before launching.
  - Failover/Retry logic within the proxy list.
- **In-Memory Cache**: 10-second RAM cache for instant repeated requests.
- **Evasion Suite**: Dynamic fingerprinting, stealth plugins, and mimicking human signals.

## 📦 Setup & Installation

### 1. Prerequisites
- Node.js (v18+)
- npm

### 2. Installation
```bash
# Install dependencies
npm install

# Install Playwright browser
npx playwright install chromium
```

### 3. Environment Configuration (`.env`)
```env
PORT=3000

# Proxy Toggle
WITH_PROXY=true
ALLOW_DIRECT_FALLBACK=true

# Multi-Proxy Configuration (Comma Separated)
PROXY_URL=http://proxy1.net:9999,http://proxy2.net:9999
PROXY_USERNAME=user1,user2
PROXY_PASSWORD=pass1,pass2

# Performance
MAX_CONCURRENT=5
```

## 🏃 Usage

### Development Mode
```bash
npm run dev
```

### Production Build
```bash
npm run build
npm start
```

## 🧪 API Endpoints

### 1. Scrape Naver Product
**Endpoint**: `GET /naver`  
**Example**: `http://localhost:3000/naver?productUrl=https://smartstore.naver.com/yeon_a_cosmetic/products/10731856526`

**Response (fromCache indicated)**:
```json
{
  "success": true,
  "platform": "naver",
  "fromCache": false,
  "data": { ... },
  "timestamp": "2026-02-09T15:45:00.000Z",
  "requestId": "abc123"
}
```

## 🛡️ Stealth & Performance Strategy

1. **Snap Simulation**: Minimalist human signals (<1s) to evade bot detection while maintaining speed.
2. **Resource Blocking**: Aborts requests for images, videos, and fonts to ensure instant page loads.
3. **Internal API Interception**: Captures accurately parsed JSON instead of fragile HTML selectors.
4. **Resilient Rolling**: If one proxy is blocked or down, the system automatically tries the next one in the list.

---
*Developed for High-Speed E-commerce Data Acquisition.*
