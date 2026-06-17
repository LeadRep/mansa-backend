import { DataTypes, Model, Optional } from "sequelize";
import { database } from "../configs/database/database";
import ACICompanies from "./ACICompanies";

export interface ACICompanyExclusionAttributes {
  id: string;
  organizationId: string;
  companyId: string;
  excludedByUserId: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export type ACICompanyExclusionCreationAttributes = Optional<
  ACICompanyExclusionAttributes,
  "id"
>;

class ACICompanyExclusions
  extends Model<
    ACICompanyExclusionAttributes,
    ACICompanyExclusionCreationAttributes
  >
  implements ACICompanyExclusionAttributes
{
  declare id: string;
  declare organizationId: string;
  declare companyId: string;
  declare excludedByUserId: string;
  declare createdAt?: Date;
  declare updatedAt?: Date;
}

ACICompanyExclusions.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      unique: true,
    },
    organizationId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    companyId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    excludedByUserId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
  },
  {
    sequelize: database,
    modelName: "ACICompanyExclusions",
    tableName: "ACICompanyExclusions",
    timestamps: true,
  }
);

ACICompanyExclusions.belongsTo(ACICompanies, {
  foreignKey: "companyId",
  targetKey: "id",
  as: "company",
});

export default ACICompanyExclusions;