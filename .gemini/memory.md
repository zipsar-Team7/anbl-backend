# 🧪 ANBL Research Backend - Agent Memory

This document stores the operational memory, architectural patterns, and development guidelines for the **ANBL Research Backend** workspace.

---

## 🏛 Project Overview
The ANBL Backend is a Node.js and Express API service that interfaces with MongoDB Atlas to store and query nanomedicine research datasets. It exposes endpoints for two major research platforms: **Neuro-Bio-Axis** (neurological interactions) and **Poly-ToxMap** (polymer nanomaterial toxicity).

## 🛠 Tech Stack
- **Runtime Environment:** Node.js (ES Modules syntax using `"type": "module"`)
- **Web Framework:** Express.js (v5.x)
- **Object Modeling (ODM):** Mongoose (v9.x)
- **Security Suite:** 
  - `helmet`: Express security headers.
  - `express-rate-limit`: Scraping mitigation (limit: 100 requests per 15 minutes per IP).
  - Body parser restrictions (10kb maximum body payload size).
  - Sanitized Error Masking: Production hides stack traces and prints `SERVER_ERROR` console alerts.

---

## 🗄 Database Structure & Models

### 1. `Material` ([Material.js](file:///D:/Zipsar-Base/anbl-backend/models/Material.js))
- **Purpose:** Backs the **Neuro-Bio-Axis** (Tool 1) search engine.
- **Fields:** Captures nanoparticle physical specifications (size, shape, Zeta potential) and biological reactions (in vitro cell types, stimulants, pro-inflammatory responses, in vivo animal specifications, administration routes, and biosafety outcomes).

### 2. `PolyToxMaterial` ([PolyToxMaterial.js](file:///D:/Zipsar-Base/anbl-backend/models/PolyToxMaterial.js))
- **Purpose:** Backs the **Poly-ToxMap** (Tool 2) search engine.
- **Fields:** Focuses on polymer types, functional groups, core size, shapes, cell type origins, and viability/toxicity percentages.

### 3. `Citation` ([Citation.js](file:///D:/Zipsar-Base/anbl-backend/models/Citation.js))
- **Purpose:** Powers the searchable bibliography on the laboratory portal website.

---

## 🔌 API Routing Table

| Route Pattern | Controller File | Purpose |
| :--- | :--- | :--- |
| `GET /api/health` | [index.js](file:///D:/Zipsar-Base/anbl-backend/routes/index.js) | Server status health check |
| `GET /api/search` | [searchController.js](file:///D:/Zipsar-Base/anbl-backend/controllers/searchController.js) | Unified multi-criteria nanoparticle search |
| `GET /api/filters` | [searchController.js](file:///D:/Zipsar-Base/anbl-backend/controllers/searchController.js) | Returns unique filters for search inputs |
| `GET /api/records/:id` | [searchController.js](file:///D:/Zipsar-Base/anbl-backend/controllers/searchController.js) | Returns detailed specs for a single record |
| `POST /api/predict` | [predictionController.js](file:///D:/Zipsar-Base/anbl-backend/controllers/predictionController.js) | Predicts polymer-nanomaterial toxicity stats |
| `GET /api/citations` | [citationController.js](file:///D:/Zipsar-Base/anbl-backend/controllers/citationController.js) | Retrieves publication citations |

---

## ⚡ Setup & CLI Seeding
Datasets are parsed and seeded using CSV import scripts:
- **Seed Neuro-Bio-Axis Data:** `npm run import-materials` (seeds from `data/webtool-1-data.csv`)
- **Seed Citations Data:** `npm run import-data` (seeds from `data/citations.csv`)
- **Seed Poly-ToxMap Data:** `npm run import-polytox` (seeds from `data/webtolol-2-data.json`)
