// src/models/ACILeadTicket.ts
import { DataTypes, Model, Optional } from 'sequelize';
import {database} from "../configs/database/database";

export type TicketStatus = 'open' | 'in_review' | 'resolved' | 'rejected';
export type TicketField =
  | 'name' | 'title' | 'company' | 'country' | 'city' | 'email'
  | 'phone' | 'linkedinUrl' | 'aum' | 'companySize' | 'segment'
  | 'allocationFocus' | 'score' | 'other';

export interface ACILeadTicketAttributes {
  id: string;
  leadId: string;
  leadName: string;
  leadCompany: string | null;
  field: string  | null;
  description: string;
  status: string;
  resolution: string | null;
  organizationId: string;
  submittedBy: string;
}

export type ACILeadTicketCreationAttributes = Optional<ACILeadTicketAttributes, 'id' | 'status' | 'resolution'>;

class ACILeadTickets extends Model<ACILeadTicketAttributes, ACILeadTicketCreationAttributes>
  implements ACILeadTicketAttributes {
  declare id: string;
  declare leadId: string;
  declare leadName: string;
  declare leadCompany: string | null;
  declare field: string | null;
  declare description: string;
  declare status: string;
  declare resolution: string | null;
  declare organizationId: string;
  declare submittedBy: string;
}

ACILeadTickets.init(
  {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    leadId: { type: DataTypes.STRING, allowNull: false, field: 'lead_id' },
    leadName: { type: DataTypes.STRING, allowNull: false, field: 'lead_name' },
    leadCompany: { type: DataTypes.STRING, allowNull: true, field: 'lead_company' },
    field: { type: DataTypes.STRING, allowNull: true,},
    description: { type: DataTypes.TEXT, allowNull: false },
    status: {type: DataTypes.STRING, allowNull: false, defaultValue: 'open',},
    resolution: { type: DataTypes.TEXT, allowNull: true },
    organizationId: { type: DataTypes.UUID, allowNull: false, field: 'organization_id' },
    submittedBy: { type: DataTypes.UUID, allowNull: false, field: 'submitted_by' },
  },
  {
    sequelize: database,
    modelName: 'aci_lead_tickets',
    timestamps: true,
  }
);

export default ACILeadTickets;