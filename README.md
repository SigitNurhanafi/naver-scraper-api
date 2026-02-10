# Naver Scraper API 🕷️

A high-performance, stealthy API to scrape product details from Naver SmartStore. Built with Node.js, TypeScript, and Playwright.

## 🌟 Key Features
- **Stealth Mode**: Uses advanced fingerprinting to mimic real users.
- **Auto-Switching Proxies**: Automatically rotates proxies if one fails.
- **Smart Navigation**: Tries to "browse" naturally first, then searches, and only uses direct links as a last resort.
- **JSON Output**: Returns clean, structured JSON data.

---

## 🛠️ Prerequisites (Before you start)

Make sure you have these installed on your computer:
1.  **Node.js** (Version 18 or higher) - [Download Here](https://nodejs.org/)
2.  **Git** (Optional, to clone the repo) - [Download Here](https://git-scm.com/)

---

## 🚀 Installation Guide (Step-by-Step)

### 1. Setup the Project
Open your terminal (Command Prompt / PowerShell / Terminal) and run:

```bash
# 1. Install project dependencies
npm install

# 2. Install the browsers for automation (CRITICAL STEP!)
npx playwright install chromium
```

### 2. Configure Environment (`.env`)
You need to create a configuration file.
1.  Copy the example file: `cp .env.example .env` (or manually rename/copy it).
2.  Open `.env` in a text editor (VS Code, Notepad, etc.).

**Simple Configuration Guide:**

```env
# Server Port (Default: 3000)
PORT=3000

# --- PROXY SETTINGS ---
# Set to 'true' to use proxies from proxies.json
WITH_PROXY=true

# If proxies fail, should we try using your direct internet? (true/false)
ALLOW_DIRECT_FALLBACK=true

# How many concurrent scrapes allowed?
MAX_CONCURRENT=5
```

### 3. Setup Proxies (`proxies.json`)
The system uses `proxies.json` to manage proxies. This file is gitignored to keep your credentials safe.

1.  Copy the example file: `cp proxies.json.example proxies.json` (or manually rename/copy).
2.  Edit `proxies.json` with your actual proxy list.

**Supported Types:** HTTP, HTTPS, SOCKS4, SOCKS5.

**Example Content:**
```json
[
  {
    "server": "http://user:pass@1.2.3.4:8080"
  },
  {
    "server": "socks5://user:pass@5.6.7.8:1080"
  },
  {
    "server": "http://1.2.3.4:8080",
    "username": "user1",
    "password": "pass1"
  }
]
```
*Note: You can put credentials in the URL or as separate fields.*

---

## 🏃‍♂️ How to Run

### Development Mode (For testing/editing)
Use this when you are changing code. It auto-restarts on save.
```bash
npm run dev
```
*You should see: `Server is running on port 3000`*

### Production Mode (For deployment)
Use this for actual usage (faster and stable).
```bash
npm run build
npm start
```

---

## 🧪 How to Use

### Scrape a Product
Open your browser or use Postman and visit:

`GET http://localhost:3000/naver?productUrl=[NAVER_PRODUCT_URL]`

**Example:**
`http://localhost:3000/naver?productUrl=https://smartstore.naver.com/yeon_a_cosmetic/products/10731856526`

**Successful Response:**
```json
{
  "success": true,
  "data": {
    "benefits": { ... },
    "productDetails": { ... }
  }
}
```

---

## ❓ Troubleshooting (Common Issues)

**Q: "Executable doesn't exist at..."**
A: You forgot to install the browser. Run: `npx playwright install chromium`

**Q: "TimeoutError: page.goto: Timeout 30000ms exceeded"**
A: Note that Naver is slow or your Proxy is slow. 
- Try setting `WITH_PROXY=false` to test if it works with your direct connection.
- Check if your Proxy IP is banned.

**Q: "Target closed unexpectedly"**
A: The coordination between browser and script failed. This usually happens if the machine runs out of RAM or the browser crashes. Try reducing `MAX_CONCURRENT`.

---

## 📂 Project Structure
- `src/app.ts`: Entry point of the server.
- `src/services/scrapers/`: Where the scraping magic happens.
- `src/config/`: Configuration files.
- `src/utils/`: Helper functions (logging, formatting).
