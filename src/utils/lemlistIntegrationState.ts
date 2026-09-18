import { CustomerPref } from "../models/CustomerPref";

type PlainRecord = Record<string, any>;

const clonePlainObject = (value: unknown): PlainRecord => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return JSON.parse(JSON.stringify(value)) as PlainRecord;
};

export const getAppSettingsObject = (appSettings: unknown): Record<string, any> =>
  clonePlainObject(appSettings);

export const getLemlistEncryptedApiKey = (customerPref: CustomerPref) => {
  return customerPref.lemlistApiKeyEncrypted ?? null;
};

export const getLemlistConfig = (customerPref: CustomerPref): Record<string, any> => {
  const appSettings = getAppSettingsObject(customerPref.appSettings);
  const integrations = clonePlainObject(appSettings.integrations);
  const lemlistConfig = clonePlainObject(integrations.lemlist ?? integrations.Lemlist);
  const { apiKeyEncrypted: _secret, ...safeLemlistConfig } = lemlistConfig;

  return {
    ...safeLemlistConfig,
    apiKeyEncrypted: getLemlistEncryptedApiKey(customerPref),
  };
};
