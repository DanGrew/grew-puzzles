// A puzzle's created date as players read it — the browse tiles and the play page both show it.

// 2026-10-02 → 2 Oct 2026.
export function dayLabel(created) {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const [year, month, day] = created.split('-').map(Number);
  return `${day} ${months[month - 1]} ${year}`;
}
