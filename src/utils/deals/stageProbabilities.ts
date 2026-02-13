export const applyStageProbabilities = (stages: any[]) => {
  if (!Array.isArray(stages)) return [];
  if (stages.length === 0) return [];
  const step = 100 / stages.length;
  return stages.map((stage, index) => ({
    ...stage,
    probability: Math.round(step * (index + 1)),
  }));
};
