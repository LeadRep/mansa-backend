export const isProdEnv = (): boolean => {
  return process.env.APP_ENV === "poduction" || process.env.APP_ENV === "production";
};