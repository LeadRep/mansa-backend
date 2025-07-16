import { DataTypes, Model } from "sequelize";
import { database } from "../configs/database/database";

export enum SequenceStatus {
  PENDING = "pending",
  SENT = "sent",
  FAILED = "failed",
}

interface Sequence {
  date: Date;
  status: SequenceStatus;
}

export interface NewUsersSequenceAttributes {
  id: string;
  email: string;
  user_id: string;
  first_sequence: Sequence;
  second_sequence?: Sequence;
  third_sequence?: Sequence;
}

export class NewUsersSequence extends Model<NewUsersSequenceAttributes> {
  [x: string]: any;
}

NewUsersSequence.init(
    {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
            unique: true,
        },
        email: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: true,
        },
        user_id: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: true,
        },
        first_sequence: {
            type: DataTypes.JSONB,
            allowNull: false,
            defaultValue: {
                date: new Date(),
                status: SequenceStatus.PENDING,
            },
        },
        second_sequence: {
            type: DataTypes.JSONB,
            allowNull: false,
            defaultValue: {
                date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
                status: SequenceStatus.PENDING,
            },
        },
        third_sequence: {
            type: DataTypes.JSONB,
            allowNull: false,
            defaultValue: {
                date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 2 days from now
                status: SequenceStatus.PENDING,
            },
        },
    },
    {
        sequelize: database,
        tableName: "NewUsersSequence",
        timestamps: true,
    }
);

export default NewUsersSequence;
