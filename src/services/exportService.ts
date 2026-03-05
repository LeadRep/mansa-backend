// typescript
// File: `src/services/exportService.ts`
import { ExportJob } from '../models/ExportJob';
import { LeadExport } from '../models/LeadExport';
import { database } from '../configs/database/database';
import MonthlyQuotas from "../models/MonthlyQuotas";

// Use a transaction: create job, bulkCreate lead exports, bulk update GeneralLeads exported flag
export async function recordLeadExport(leadIds: string[], userId: string, organization_id: string, format = 'csv') {
  return database.transaction(async (tx) => {
    const job = await ExportJob.create(
      {
        user_id: userId,
        organization_id: organization_id,
        format,
        status: 'completed',
        total_count: leadIds.length,
      },
      { transaction: tx }
    );

    const records = leadIds.map((leadId) => ({
      lead_id: leadId,
      export_job_id: job.id,
      exported_for_organization_id: organization_id,
    }));

    await LeadExport.bulkCreate(records, { transaction: tx, validate: false });

    // decrement MonthlyQuotas remaining by number of leads exported within the transaction
    await MonthlyQuotas.decrement('remaining', { by: records.length, where: { organization_id } });

    return job;
  });
}