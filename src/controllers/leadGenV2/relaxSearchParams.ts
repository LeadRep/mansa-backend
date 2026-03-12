export const relaxSearchParams = (
  aiQueryParams: Record<string, any> | null | undefined
) => {
  const params = {
    ...(typeof aiQueryParams === "object" && aiQueryParams !== null
      ? aiQueryParams
      : {}),
  } as Record<string, any>;

  const hasRevenue =
    params["revenue_range[min]"] || params["revenue_range[max]"];
  if (hasRevenue) {
    delete params["revenue_range[min]"];
    delete params["revenue_range[max]"];
    return params;
  }

  if (Array.isArray(params.organization_num_employees_ranges) && params.organization_num_employees_ranges.length) {
    delete params.organization_num_employees_ranges;
    return params;
  }

  if (Array.isArray(params.organization_locations) && params.organization_locations.length) {
    delete params.organization_locations;
    return params;
  }
   if (Array.isArray(params.person_seniorities) && params.person_seniorities.length) {
    delete params.person_seniorities;
    return params;
  }

  if (Array.isArray(params.person_titles) && params.person_titles.length) {
    delete params.person_titles;
    return params;
  }

  return params;
};
