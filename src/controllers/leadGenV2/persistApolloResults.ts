import { Op } from "sequelize";
import { GeneralLeads } from "../../models/GeneralLeads";
import Companies from "../../models/Companies";
import { ApolloPerson } from "./types";

export const persistApolloResults = async (people: ApolloPerson[]) => {
  const orgs = people
    .map((person) => person?.organization)
    .filter((org) => org && typeof org.id === "string");

  if (orgs.length) {
    const orgIds = [...new Set(orgs.map((org) => org.id))];
    const existing = await Companies.findAll({
      where: { external_id: { [Op.in]: orgIds } },
      attributes: ["external_id"],
    });
    const existingIds = new Set(existing.map((item) => item.external_id));

    const toCreate = orgs
      .filter((org) => !existingIds.has(org.id))
      .map((org) => {
        const { id, ...companyInfo } = org;
        return {
          ...companyInfo,
          external_id: id,
        };
      });

    if (toCreate.length) {
      await Companies.bulkCreate(toCreate);
    }
  }

  const externalIds = people
    .map((person) => person?.id ?? person?.person_id)
    .filter((id): id is string => typeof id === "string" && id.length > 0);

  if (!externalIds.length) {
    return;
  }

  const existingLeads = await GeneralLeads.findAll({
    where: { external_id: { [Op.in]: externalIds } },
    attributes: ["external_id"],
  });
  const existingIds = new Set(existingLeads.map((item) => item.external_id));
  const seenInBatch = new Set<string>();

  const toCreate = people
    .filter((person) => {
      const externalId = person?.id ?? person?.person_id;
      if (!externalId) {
        return false;
      }
      if (existingIds.has(externalId) || seenInBatch.has(externalId)) {
        return false;
      }
      seenInBatch.add(externalId);
      return true;
    })
    .map((person) => {
      const externalId = person?.id ?? person?.person_id ?? null;
      const { id, person_id, ...leadInfo } = person ?? {};
      return {
        ...leadInfo,
        external_id: externalId,
      };
    });

  if (toCreate.length) {
    await GeneralLeads.bulkCreate(toCreate, { ignoreDuplicates: true });
  }
};
