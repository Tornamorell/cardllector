/** Grading companies offered in the edit form; any other is typed in (D27). */
export const GRADING_COMPANIES = ["PSA", "BGS", "CGC", "SGC", "TAG", "ACE"] as const;

export const GRADING_LABELS: Record<string, string> = {
  BGS: "Beckett (BGS)",
  ACE: "Ace Grading",
};

/** "PSA 10", "BGS 9.5" — written the way collectors write it, with a dot (D21). */
export function gradeLabel(company: string | null, grade: number | null): string | null {
  if (!company) return null;
  if (grade == null) return company;
  return `${company} ${Number.isInteger(grade) ? grade : grade.toFixed(1)}`;
}
