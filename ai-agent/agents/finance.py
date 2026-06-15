from typing import List, Dict, Any

class FinanceDebtAgent:
    def __init__(self, mistral_client=None):
        self.client = mistral_client

    def generate_repayment_plan(self, debts: List[Dict[str, Any]], monthly_budget: float) -> Dict[str, Any]:
        """
        Calculates optimal debt paydown strategy (Avalanche/Snowball) and provides financial recommendations.
        """
        debts_summary = "\n".join([
            f"- {d.get('name')}: Principal ${d.get('balance')}, APR {d.get('apr')}%" for d in debts
        ])
        
        prompt = (
            f"You are a Personal Finance & Debt Advisory Agent.\n"
            f"Analyze the following debts and suggest an optimized repayment plan based on a monthly budget of ${monthly_budget}.\n\n"
            f"--- Debts ---\n{debts_summary}\n\n"
            f"Suggest:\n"
            f"1. Debt Avalanche vs. Debt Snowball comparison for this scenario.\n"
            f"2. Exact payment allocation roadmap.\n"
            f"3. Practical budgeting hacks to save interest fees."
        )

        if not self.client:
            # Simulated response for testing
            sorted_debts = sorted(debts, key=lambda x: x.get('apr', 0), reverse=True)
            avalanche_order = [d.get('name') for d in sorted_debts]
            return {
                "recommended_strategy": "Debt Avalanche (High Interest First)",
                "paydown_order": avalanche_order,
                "monthly_budget_allocation": f"Pay minimums on all. Direct remaining amount of the ${monthly_budget} to {avalanche_order[0]}.",
                "advisory": "[DEMO MODE] Focus on high APR cards first. Try to increase monthly payment to shorten payoff window.",
            }

        try:
            if hasattr(self.client, "chat") and hasattr(self.client.chat, "complete"):
                response = self.client.chat.complete(
                    model="mistral-tiny",
                    messages=[{"role": "user", "content": prompt}]
                )
            else:
                from mistralai.models.chat_completion import ChatMessage
                response = self.client.chat(
                    model="mistral-tiny",
                    messages=[ChatMessage(role="user", content=prompt)]
                )
            analysis = response.choices[0].message.content
            return {"repayment_plan": analysis, "status": "processed"}
        except Exception as e:
            return {"error": str(e), "status": "failed"}
