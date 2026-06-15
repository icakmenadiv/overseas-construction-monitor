(() => {
  const ALLOWED_STAGE_ORDER = [
    "study",
    "planning",
    "pre-procurement",
    "tender",
    "bid-evaluation",
    "awarded",
    "contracted",
    "financing",
    "construction",
    "completion",
    "operation",
    "on-hold",
    "cancelled",
  ];

  const STAGE_ALIASES = [
    { stage: "study", patterns: ["study", "feasibility", "pre-feasibility", "pre feasibility", "concept", "assessment", "survey"] },
    { stage: "planning", patterns: ["planning", "plan", "design", "permitting", "preparation"] },
    { stage: "pre-procurement", patterns: ["pre-procurement", "pre procurement", "preprocurement", "pre-qualification", "prequalification", "pre qualification", "pq", "eoi", "expression of interest", "pre-tender", "pre tender"] },
    { stage: "tender", patterns: ["tender", "bidding", "bid submission", "rfp", "request for proposal", "rfq", "request for quotation", "procurement"] },
    { stage: "bid-evaluation", patterns: ["bid-evaluation", "bid evaluation", "evaluation", "evaluating", "technical evaluation", "financial evaluation"] },
    { stage: "awarded", patterns: ["awarded", "award", "contract award", "contract awarded", "preferred bidder", "selected bidder", "winner"] },
    { stage: "contracted", patterns: ["contracted", "contract signing", "contract signed", "signing", "signed", "epc contract", "contract"] },
    { stage: "financing", patterns: ["financing", "financial close", "financial closure", "funding", "fundraising", "investment decision", "fid"] },
    { stage: "construction", patterns: ["construction", "under construction", "pre-construction", "pre construction", "groundbreaking", "works started", "implementation"] },
    { stage: "completion", patterns: ["completion", "completed", "commissioning", "testing", "handover", "delivered"] },
    { stage: "operation", patterns: ["operation", "operational", "operating", "o&m", "maintenance", "commercial operation"] },
    { stage: "on-hold", patterns: ["on-hold", "on hold", "hold", "suspended", "suspension", "paused", "delayed", "deferred"] },
    { stage: "cancelled", patterns: ["cancelled", "canceled", "cancellation", "terminated", "scrapped"] },
  ];

  function normalizeStageForRule(value) {
    const normalized = normalizeStageToken(value);
    if (!normalized || normalized === "-") return "-";
    if (ALLOWED_STAGE_ORDER.includes(normalized)) return normalized;

    const matched = STAGE_ALIASES.find(({ patterns }) =>
      patterns.some((pattern) => normalized === pattern || normalized.includes(pattern)),
    );
    return matched ? matched.stage : normalized;
  }

  function normalizeStageToken(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/[–—]/g, "-")
      .replace(/_/g, "-")
      .replace(/\s+/g, " ")
      .trim();
  }

  function getAllowedStageRank(value) {
    const normalized = normalizeStageForRule(value);
    const index = ALLOWED_STAGE_ORDER.indexOf(normalized);
    return index === -1 ? 999 : index;
  }

  const originalNormalizeProject = window.normalizeProject;
  if (typeof originalNormalizeProject === "function") {
    window.normalizeProject = function normalizeProjectWithStageRules(...args) {
      const project = originalNormalizeProject.apply(this, args);
      project.stage = normalizeStageForRule(project.stage);
      return project;
    };
  }

  window.sortStageValues = function sortStageValuesByProjectRule(values) {
    const existing = new Set(values.map(normalizeStageForRule).filter((value) => value && value !== "-"));
    return [
      ...ALLOWED_STAGE_ORDER.filter((stage) => existing.has(stage)),
      ...[...existing]
        .filter((stage) => !ALLOWED_STAGE_ORDER.includes(stage))
        .sort((a, b) => a.localeCompare(b, "ko")),
    ];
  };

  window.getStageRank = getAllowedStageRank;
  window.normalizeStageName = normalizeStageForRule;
})();