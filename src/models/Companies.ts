import { Model, DataTypes } from "sequelize";
import { database } from "../configs/database/database";

export interface CompaniesAttributes {
    id: string;
    external_id:string | null;
    name: string;
    website_url: string | null;
    blog_url: string | null;
    angellist_url: string | null;
    linkedin_url: string | null;
    twitter_url: string | null;
    facebook_url: string | null;
    primary_phone: JSON | null;
    languages: string[] | null;
    alexa_ranking: number | null;
    phone: string | null;
    linkedin_uid: string | null;
    founded_year: number | null;
    publicly_traded_symbol: string | null;
    publicly_traded_exchange: string | null;
    logo_url: string | null;
    crunchbase_url: string | null;
    primary_domain: string | null;
    sic_codes: string[] | null;
    naics_codes: string[] | null;
    sanitized_phone: string | null;
    owned_by_organization_id: string | null;
    organization_revenue_printed: string | null;
    organization_revenue: number | null;
    intent_strength: string | null;
    show_intent: boolean | null;
    has_intent_signal_account: boolean | null;
    intent_signal_account: JSON | null;
    organization_headcount_six_month_growth: number | null;
    organization_headcount_twelve_month_growth: number | null;
    organization_headcount_twenty_four_month_growth: number | null;
}

export class Companies extends Model<CompaniesAttributes> {
    [x: string]: any;
}

Companies.init(
    {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
            unique: true,
        },
        external_id:{
            type:DataTypes.STRING,
            allowNull:true,
            defaultValue:null
        },
        name: {
            type: DataTypes.STRING(255),
            allowNull: true,
        },
        website_url: {
            type: DataTypes.STRING,
            allowNull: true,
            defaultValue: null,
        },
        blog_url: {
            type: DataTypes.STRING,
            allowNull: true,
            defaultValue: null,
        },
        angellist_url: {
            type: DataTypes.STRING,
            allowNull: true,
            defaultValue: null,
        },
        linkedin_url: {
            type: DataTypes.STRING,
            allowNull: true,
            defaultValue: null,
        },
        twitter_url: {
            type: DataTypes.STRING,
            allowNull: true,
            defaultValue: null,
        },
        facebook_url: {
            type: DataTypes.STRING,
            allowNull: true,
            defaultValue: null,
        },
        primary_phone: {
            type: DataTypes.JSON,
            allowNull: true,
            defaultValue: null,
        },
        languages: {
            type: DataTypes.ARRAY(DataTypes.STRING),
            allowNull: true,
            defaultValue: null,
        },
        alexa_ranking: {
            type: DataTypes.INTEGER,
            allowNull: true,
            defaultValue: null,
        },
        phone: {
            type: DataTypes.STRING,
            allowNull: true,
            defaultValue: null,
        },
        linkedin_uid: {
            type: DataTypes.STRING,
            allowNull: true,
            defaultValue: null,
        },
        founded_year: {
            type: DataTypes.INTEGER,
            allowNull: true,
            defaultValue: null,
        },
        publicly_traded_symbol: {
            type: DataTypes.STRING,
            allowNull: true,
            defaultValue: null,
        },
        publicly_traded_exchange: {
            type: DataTypes.STRING,
            allowNull: true,
            defaultValue: null,
        },
        logo_url: {
            type: DataTypes.STRING,
            allowNull: true,
            defaultValue: null,
        },
        crunchbase_url: {
            type: DataTypes.STRING,
            allowNull: true,
            defaultValue: null,
        },
        primary_domain: {
            type: DataTypes.STRING,
            allowNull: true,
            defaultValue: null,
        },
        sic_codes: {
            type: DataTypes.ARRAY(DataTypes.STRING),
            allowNull: true,
            defaultValue: null,
        },
        naics_codes: {
            type: DataTypes.ARRAY(DataTypes.STRING),
            allowNull: true,
            defaultValue: null,
        },
        sanitized_phone: {
            type: DataTypes.STRING,
            allowNull: true,
            defaultValue: null,
        },
        owned_by_organization_id: {
            type: DataTypes.STRING,
            allowNull: true,
            defaultValue: null,
        },
        organization_revenue_printed: {
            type: DataTypes.STRING,
            allowNull: true,
            defaultValue: null,
        },
        organization_revenue: {
            type: DataTypes.BIGINT,
            allowNull: true,
            defaultValue: null,
        },
        intent_strength: {
            type: DataTypes.STRING,
            allowNull: true,
            defaultValue: null,
        },
        show_intent: {
            type: DataTypes.BOOLEAN,
            allowNull: true,
            defaultValue: null,
        },
        has_intent_signal_account: {
            type: DataTypes.BOOLEAN,
            allowNull: true,
            defaultValue: null,
        },
        intent_signal_account: {
            type: DataTypes.JSON,
            allowNull: true,
            defaultValue: null,
        },
        organization_headcount_six_month_growth: {
            type: DataTypes.FLOAT,
            allowNull: true,
            defaultValue: null,
        },
        organization_headcount_twelve_month_growth: {
            type: DataTypes.FLOAT,
            allowNull: true,
            defaultValue: null,
        },
        organization_headcount_twenty_four_month_growth: {
            type: DataTypes.FLOAT,
            allowNull: true,
            defaultValue: null,
        },

    },
    {
        sequelize: database,
        tableName: "Companies",
        timestamps: true
    }
);

export default Companies;
