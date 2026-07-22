# Empire Cuisine Booking Sync

Google Apps Script (clasp): master booking sheet → monthly day-reservation workbooks.

- Master is the **source of truth**
- Sync is **slot reconcile**: `slotKey` + content **fingerprint**
- **Initial sync** once, then **onChange** (writes only when content differs)
- Resource IDs live only in **Script properties**

## Sync model

| Concept | Meaning |
|---------|---------|
| `slotKey` | Monthly slot: `date::L\|D::H::Hall` or `date::L\|D::WL::index` |
| Fingerprint | Hash of booking fields (time, name, pax, …) |
| `_SyncMeta` | Hidden sheet per monthly file: `slotKey → fingerprint` |
| Create / update | New or changed slot → write day sheet |
| Delete | Slot gone from master → clear day sheet + meta |
| Unchanged | Fingerprint match → skip write |

Day updates are batched per day sheet (one data-block read/write + pax totals), not one API call per booking.

## Script properties

**Required (set once in the Apps Script editor):**

| Property | Purpose |
|----------|---------|
| `MASTER_SPREADSHEET_ID` | Master booking spreadsheet |
| `MONTHLY_FOLDER_ID` | Drive folder for monthly workbooks |
| `LOG_SPREADSHEET_ID` | Spreadsheet used for sync logs (create empty sheet yourself) |
| `TEMPLATE_SPREADSHEET_ID` | Day-layout template |

**Optional / managed by the script:**

| Property | Purpose |
|----------|---------|
| `MASTER_SHEET_NAME` | Default `Sheet1` if unset |
| `MONTH_FILE_IDS` | JSON map `YYYY-MM → spreadsheetId` |
| `INITIAL_SYNC_COMPLETED` | Set after successful `runInitialSync` |

IDs are the long string in the URL:

- Spreadsheet: `https://docs.google.com/spreadsheets/d/`**`ID`**`/edit`
- Folder: `https://drive.google.com/drive/folders/`**`ID`

## First-time setup

`clasp push` does **not** create an Apps Script project. You need a project first, then push code into it.

### A. Create or link an Apps Script project

```bash
# once: login
clasp login

# option 1 — create a new standalone project (writes .clasp.json with scriptId)
clasp create --type standalone --title "Empire Cuisine Booking Sync" --rootDir src

# option 2 — use an existing project: copy example and paste scriptId from
#   https://script.google.com → project → Project Settings → Script ID
cp .clasp.json.example .clasp.json
# edit .clasp.json → set "scriptId"
```

`.clasp.json` is gitignored (contains your `scriptId`). `rootDir` must be `src`.

### B. Push code

```bash
clasp push --force
```

### C. Configure and run (Apps Script editor)

1. Open the project: `clasp open` (or script.google.com)
2. **Project Settings → Script properties** → add the four required keys
3. Run functions in order:

| # | Function | What it does |
|---|----------|----------------|
| 1 | **`setup`** | Validate properties, ensure log sheet tab, install `onMasterChange` |
| 2 | `generateMonthlyTemplates` | Create monthly workbooks for the template year |
| 3 | `runInitialSync` | Full reconcile of master → monthly |

If initial sync hits the time limit, `continueInitialSync` is scheduled automatically. Re-run `runInitialSync` until it reports completed (later runs are no-ops once done).

### D. Steady state

After `INITIAL_SYNC_COMPLETED`:

- Changes on the master fire **`onMasterChange`** (`FORMAT` ignored)
- Master is reconciled against `_SyncMeta`; only changed slots are written
- Manual full pass anytime: **`runReconcile`**

## Deploy code updates

```bash
clasp push --force
```

Re-run **`setup`** only if triggers need reinstalling.

## Other functions

| Function | Use |
|----------|-----|
| `refreshMonthIds` | Rebuild `MONTH_FILE_IDS` from the monthly Drive folder |
| `runReconcile` | Full reconcile (repair / catch-up) |
