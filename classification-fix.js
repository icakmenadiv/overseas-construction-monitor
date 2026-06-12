const INFO_CLASS_FILTER_ORDER = [
  "프로젝트 정보",
  "정부/민간 인프라투자 동향",
  "정부/민간 인프라 투자동향",
  "인프라 투자 동향",
  "건설관련 법령 제개정",
  "건설 관련 법령 제·개정",
  "외국기업 동향",
  "외국 기업 동향",
  "일반 동향",
];

const INFO_CLASS_DISPLAY_LABELS = {
  "정부/민간 인프라 투자동향": "정부/민간 인프라투자 동향",
  "인프라 투자 동향": "정부/민간 인프라투자 동향",
};

let isReorderingInfoClassFilter = false;

function normalizeInfoClassLabel(value) {
  return INFO_CLASS_DISPLAY_LABELS[value] || value;
}

function getInfoClassFilterRank(value) {
  const index = INFO_CLASS_FILTER_ORDER.indexOf(value);
  return index === -1 ? 999 : index;
}

function reorderInfoClassFilter() {
  if (isReorderingInfoClassFilter) return false;

  const container = document.getElementById("infoClassFilter");
  if (!container || !container.children.length) return false;

  const chips = [...container.querySelectorAll(".check-chip")];
  if (!chips.length) return false;

  chips.forEach((chip) => {
    const input = chip.querySelector('input[type="checkbox"]');
    const text = chip.querySelector("span");
    if (input && text) text.textContent = normalizeInfoClassLabel(input.value);
  });

  const sortedChips = [...chips].sort((a, b) => {
    const valueA = a.querySelector('input[type="checkbox"]')?.value || "";
    const valueB = b.querySelector('input[type="checkbox"]')?.value || "";
    const rank = getInfoClassFilterRank(valueA) - getInfoClassFilterRank(valueB);
    return rank || normalizeInfoClassLabel(valueA).localeCompare(normalizeInfoClassLabel(valueB), "ko");
  });

  const currentOrder = chips.map((chip) => chip.querySelector('input[type="checkbox"]')?.value || "").join("\u001f");
  const nextOrder = sortedChips.map((chip) => chip.querySelector('input[type="checkbox"]')?.value || "").join("\u001f");
  if (currentOrder === nextOrder) return true;

  isReorderingInfoClassFilter = true;
  sortedChips.forEach((chip) => container.appendChild(chip));
  isReorderingInfoClassFilter = false;
  return true;
}

document.addEventListener("DOMContentLoaded", () => {
  let attempts = 0;
  const retry = () => {
    attempts += 1;
    const completed = reorderInfoClassFilter();
    if (!completed && attempts < 30) setTimeout(retry, 100);
  };
  retry();

  const container = document.getElementById("infoClassFilter");
  if (container) {
    const observer = new MutationObserver(() => {
      if (!isReorderingInfoClassFilter) reorderInfoClassFilter();
    });
    observer.observe(container, { childList: true });
  }
});
