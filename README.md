lets create step1LeadGen, this is the flow;
1. create an empty array to save leads to evaluate, another array to save evaluated leads, pageToFetch, TotalPage

2. fetch TempLeads whose owner_id is the userId and save them to leads to evaluate array, if there are no temp leads proceed to next step3, if there are leads proceed to step4 

3. fetch the user customerPref and set leadsGenerationStatus to ongoing, get the aiQueryParams from customerPref if there is no aiQueryParams generate it using aiPeopleSearchQuery function and save to customerPref, if there is aiQueryParams check if currentPage is less than totalPages, if yes then set pageToFetch to currentPage +1. but if currentPage is greater than or equal to then remove the very of these items you find on this list from the aiQueryParams object; include_similar_titles, person_seniorities, contact_email_status, organization_locations, organization_num_employees_ranges, revenue_range[min], revenue_range[max],  

3. call apolloPeopleSearch using the aiQueryParams
4. 
3. Check if there leads in TempLeads table for the user, if yes then check if they are up to totalLeads and if they already exist in Leads table for the user(if you get up to totalLeads skip step 4 else continue to step4), if the user don't have leads on step4 proceed to step 4
4.  take the totalLeads required and check if they exist in Leads for the particular user, if they do delete them from TempLeads table and and continue finding till you get totalLeads required if after going through you don't get the total number you need call the next page on appollo, if there is no next page proceed to step 5
5. 

## Ops Runbook: Apollo ACI Lead Refresh (runId-based)

Use this runbook to execute one refresh cycle with a fixed `runId` so every stage (enqueue, fetch, apply) is traceable.

### Prerequisites
- Backend env is configured (especially `APOLLO_API_KEY`).
- Build artifacts exist in `dist/`.
- DB migrations are up to date.

### Copy-paste commands

```bash
cd /Users/eblohoue/IdeaProjects/leadRep/mansa-backend

# 1) Build + migrate
npm run build
npm run migrate

# 2) Choose a runId (example format)
RUN_ID="11111111-2222-3333-4444-555555555555"

# 3) Enqueue jobs (stale selection mode)
npm run apollo:refresh:enqueue -- --runId="$RUN_ID" --requestedBy="ops" --staleDays=30 --limit=500

# 4) Fetch snapshots from Apollo (repeat until nothing left to process)
npm run apollo:refresh:fetch -- --runId="$RUN_ID" --limit=200 --batchSize=10 --maxAttempts=3

# 5) Dry-run apply to preview updates
npm run apollo:refresh:apply:dry -- --runId="$RUN_ID" --limit=500

# 6) Apply updates to aci_leads
npm run apollo:refresh:apply -- --runId="$RUN_ID" --limit=500
```

### Explicit external_id mode (optional)

```bash
cd /Users/eblohoue/IdeaProjects/leadRep/mansa-backend
RUN_ID="11111111-2222-3333-4444-555555555555"
npm run apollo:refresh:enqueue -- --runId="$RUN_ID" --requestedBy="ops" --externalIds="5e708e8ec62c610001efeb5e"
```

### Enqueue every ACI lead

Use this when you want to backfill the entire `aci_leads` table. It pages through all rows with a non-null `external_id`, so it works for large tables without building a giant CSV argument.

```bash
cd /Users/eblohoue/IdeaProjects/leadRep/mansa-backend
RUN_ID="11111111-2222-3333-4444-555555555555"
npm run apollo:refresh:enqueue -- --runId="$RUN_ID" --requestedBy="ops" --all=true --limit=5000
```

### Notes
- `fetch` is idempotent for the same `(runId, external_id)` and uses retry rules for transient Apollo failures.
- `apply` uses payload hash short-circuiting: unchanged payloads skip field-level updates.
- Run `fetch` again for the same `runId` if some jobs were marked retryable and are waiting on `next_retry_at`.



