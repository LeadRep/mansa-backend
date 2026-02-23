import { DataTypes, Model } from "sequelize";
import { database } from "../configs/database/database";

export interface DealContactNoteAttributes {
  id?: string;
  deal_contact_id: string;
  owner_id: string;
  comment: string | null;
  file_url: string | null;
  file_name: string | null;
}

export class DealContactNote extends Model<DealContactNoteAttributes> {
  [x: string]: any;
}

DealContactNote.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      unique: true,
    },
    deal_contact_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    owner_id: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    comment: {
      type: DataTypes.TEXT,
      allowNull: true,
      defaultValue: null,
    },
    file_url: {
      type: DataTypes.TEXT,
      allowNull: true,
      defaultValue: null,
    },
    file_name: {
      type: DataTypes.TEXT,
      allowNull: true,
      defaultValue: null,
    },
  },
  {
    sequelize: database,
    modelName: "DealContactNote",
    timestamps: true,
  }
);
