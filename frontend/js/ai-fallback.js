/**
 * Client-side helpers for AI UX when the API is offline or misconfigured.
 */

export function isLikelyGreeting(text) {
  const t = (text || '').trim().toLowerCase();
  if (t.length > 80) return false;
  const greeting =
    /^(hi|hello|hey|hiya|good\s+(morning|afternoon|evening)|how\s+are\s+you|how\s+r\s+u|what'?s\s+up|sup\b|yo\b|gm\b|thanks|thank\s+you)\b/.test(t) ||
    t === 'how are you' ||
    t === 'how are you?' ||
    t === 'ok' ||
    t === 'okay';
  return greeting;
}

export function greetingAssistantReply() {
  return "Hello! I'm doing well—thanks for asking. I'm your SpendWise assistant. I can help you understand your income and spending, work toward your goals, and answer budgeting questions tailored to your situation. What would you like to talk about?";
}

export function isFinanceRelatedQuestion(text) {
  const t = (text || '').toLowerCase();
  return /\b(budget|expense|income|save|saving|goal|goals|money|spend|spending|debt|loan|invest|financial|report|analyze|recommend|recommendation|balance|savings|momo|mobile money|sacco|category|categories)\b/.test(t);
}

/**
 * Plain-object heuristic tips for reports (no dashboard-specific convert()).
 */
export function buildHeuristicReportRecommendations({
  totalIncome = 0,
  totalExpenses = 0,
  balance = 0,
  savingsRate = 0,
  topExpenseCategories = [],
  currency = 'UGX',
}) {
  const tips = [];
  const topNames = topExpenseCategories
    .slice(0, 5)
    .map((c) => (c.category || '').toLowerCase());

  if (topNames.some((n) => n.includes('transport'))) {
    tips.push('Transport is prominent in this period. Combining errands and using cheaper options where safe can free up cash in Uganda.');
  }
  if (topNames.some((n) => /airtime|data|mobile money|momo/.test(n))) {
    tips.push('Airtime, data, or mobile money fees add up. Try bundle plans and fewer small withdrawals to cut transaction costs.');
  }
  if (topNames.some((n) => n.includes('entertainment'))) {
    tips.push('Entertainment spending is noticeable. A simple weekly fun budget can keep social life affordable.');
  }
  if (topNames.some((n) => n.includes('food'))) {
    tips.push('Food and groceries are a major line item. Market shopping in bulk and more home cooking often beats daily small purchases.');
  }

  if (balance < 0) {
    tips.push(`Spending exceeded income by about ${currency} ${Math.abs(balance).toLocaleString()} in this range. Trim non-essentials first, then rebuild a small emergency buffer.`);
  } else if (balance > 0 && Number(savingsRate) > 0) {
    tips.push(`You had a surplus (savings rate ~${savingsRate}%). Consider SACCOs, unit trusts, or treasury products that match your risk comfort.`);
  } else if (balance > 0) {
    tips.push('You ended this period in the green. Automate moving part of the surplus to goals or savings before it is spent.');
  }

  if (tips.length === 0) {
    tips.push(`Track every expense for a full month in ${currency}, then aim to keep essentials under about 60% of income and use the rest for goals and savings.`);
  }

  return tips.map((p, i) => `${i + 1}. ${p}`).join('\n');
}
