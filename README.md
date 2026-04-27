# 🧪 ANBL Research Backend

A robust Node.js, Express, and MongoDB backend designed for high-performance scientific data characterization and reporting.

---

## 🏛 Architecture & Structure

The project follows a modular **MVC (Model-View-Controller)** pattern for scalability and security:

- **`models/`**: Mongoose schemas (Material, Citation). Defines scientific data structures.
- **`controllers/`**: Core business logic. Handles complex search intersections and reporting.
- **`routes/`**: API endpoint definitions.
- **`middleware/`**: Request guards (Error handling, Security, Rate Limiting).
- **`scripts/`**: Data utilities for CSV parsing and database seeding.

---

## 🛡 Security Implementation

This backend is hardened for production use with the following layers:

1.  **Rate Limiting**: Prevents automated data scraping. Limited to 100 requests per 15 minutes per IP.
2.  **Helmet.js**: Sets 15+ secure HTTP headers to protect against common web vulnerabilities (XSS, Clickjacking).
3.  **NoSQL Injection Protection**: Strict type-checking on all search inputs and categorical filters.
4.  **Error Masking**: Internal server details (stack traces) are hidden in production to prevent architecture leaks.

---

## 🛠 Setup & Development

### 1. Installation
```bash
npm install
```

### 2. Environment Configuration
Create a `.env` file in the root:
```env
PORT=5000
MONGO_URI=your_mongodb_atlas_uri
NODE_ENV=development
```

### 3. Data Import
Populate the database from scientific CSV sources:
```bash
npm run import-materials  # Imports nanoparticle research data
npm run import-data       # Imports citation and meta records
```

### 4. Run Server
```bash
npm run dev   # Runs with nodemon for auto-reloading
npm start     # Production mode
```

---

## 🔍 Debugging Notes

- **HTTP 429 Errors**: If you see this, the **Rate Limiter** is active. Wait 15 minutes or adjust the `max` value in `server.js` for testing.
- **Network Issues**: Ensure the `MONGO_URI` is correct and your IP is whitelisted in MongoDB Atlas.
- **JSON Payload Limit**: The server is limited to `10kb` payloads for security. Large bulk uploads should be handled via the provided scripts.
- **Error Logs**: Look for `SERVER_ERROR` in the console for sanitized error summaries.