# QuickHire + Betterplace Unified Dashboard

A highly performant, serverless frontend application designed to unify candidate pipeline tracking (QuickHire) with position and gap management (Betterplace). 

This dashboard allows HR Operations teams to instantly upload dual HRIS datasets, parse them locally, and view complex ageing metrics and real-time gap analysis through an interactive glassmorphism UI.

## 🔒 Complete Data Privacy & Security

**This dashboard is 100% secure and private by design.** 

Given the highly sensitive nature of recruitment and employee data, the following strict architectural decisions were made:
- **No Backend Servers:** The application is entirely client-side. There is no database or backend server connected to it.
- **In-Memory Zero-Trace Processing:** When CSV and Excel files are uploaded, they are parsed locally inside the browser's active RAM using memory-safe readers.
- **No Residual Cache:** No data is explicitly saved, cached, or persisted to `localStorage`, `sessionStorage`, browser cookies, or IndexedDB.
- **Instant Wipe:** The moment a user closes the browser tab or refreshes the page, all sensitive data is completely destroyed and purged from memory.

Your data never leaves your specific browser window on your local machine.

## ✨ Core Features

### 1. Recruitment Operations Pipeline
- **Smart Data Parsing:** Handles extensive candidate datasets with dynamic status tracking.
- **Ageing Intelligence:** Calculates time-in-stage metrics (e.g., `< 3 Days`, `4 - 7 Days`, `> 7 Days`) for critical pipeline blocks.
- **Cumulative & Specific Exports:** Download raw candidate reports isolated by their stage (Joined, Hiring Advice Pending, Ready to Offer, Ready to Join) or download a cumulative master report with one click.
- **KPI Generation:** Real-time generation of MTD (Month-To-Date), WTD (Week-To-Date), and Total Joined tracking based on historical log parsing.

### 2. Position RAOG (Required, Available, Offered, Gap) Analysis
- **Dual-File Join Architecture:** Locally bridges the Betterplace Excel dataset with candidate states to resolve position statuses.
- **Nested Search Filters:** Intuitive dropdown inputs (Build ID, Work Area, Job Role) that automatically update and restrict their suggestions based on other active filters (dependent filtering).
- **Interactive Metric Segmentation:** Granular breakdown of roles displaying their individual R, A, O, and G metrics. 
- **Actionable Visualizations:** Every metric circle acts as a filter button. Clicking an ROAG KPI instantly filters the underlying data table to show exactly who or what makes up that number.
- **Gap Exports:** Export targeted "Gap" tables instantly to CSV for stakeholder distribution.

*Metrics Logic Reference:*
- **[R] Required:** Total positions in scope
- **[A] Available:** Has an `EMP NO` assigned
- **[O] Offered:** Has a `CANDIDATEID` mapped but no `EMP NO` generated yet
- **[G] Gap:** Both `EMP NO` and `CANDIDATEID` are blank

## 🛠 Tech Stack

- **Frontend:** Vanilla HTML5, CSS3, JavaScript (ES6)
- **Styling Paradigm:** Glassmorphism UI, Responsive CSS Grid/Flexbox
- **Libraries:**
  - `PapaParse`: Fast local CSV processing
  - `SheetJS (xlsx)`: Comprehensive local Excel (.xlsx) parsing

## 🚀 How to Use

1. Launch `index.html` in any modern web browser.
2. Ensure you have your QuickHire Candidate CSV file and your Betterplace Position Detail Excel (.xlsx) file ready.
3. Upload both files sequentially in the upload pane.
4. Click **Process Dashboard**.
5. Use the top navigation bar to switch between the original operations dashboard and the new Position RAOG tracking screen.
