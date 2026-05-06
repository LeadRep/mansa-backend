import dotenv from "dotenv";

dotenv.config();
export const isProdEnv = (): boolean => {
  return process.env.APP_ENV === "poduction" || process.env.APP_ENV === "production";
};

export const getBfsLikeAccounts = (): Set<string> => {
  const accountsEnv = process.env.BFS_LIKE_ACCOUNTS || '';
  return new Set(accountsEnv.split(',').map(id => id.trim()).filter(Boolean));
};