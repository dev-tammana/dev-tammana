from typing import Dict, Any

class LegalDocAgent:
    def __init__(self, mistral_client=None):
        self.client = mistral_client

    def review_contract(self, contract_text: str, doc_type: str = "NDA") -> Dict[str, Any]:
        """
        Reviews legal texts to highlight risks, deadlines, and key liabilities.
        """
        prompt = (
            f"You are an Intelligent Legal Document Review Agent. Review this {doc_type} and conduct a risk assessment.\n\n"
            f"--- Contract Text ---\n{contract_text}\n\n"
            f"Deliver:\n"
            f"1. Critical Risk Rating (Low/Medium/High)\n"
            f"2. Hazardous or unusual clauses (e.g. indemnity, liability limits)\n"
            f"3. Important dates, deadlines, or trigger terms\n"
            f"4. Missing protective clauses recommendations"
        )

        if not self.client:
            # Simulated response for testing
            return {
                "risk_rating": "Medium",
                "clauses_of_interest": ["Indemnification details are broad", "No clear dispute resolution path"],
                "deadlines": ["No clear termination notice term mentioned"],
                "recommendations": ["Add a standard force majeure clause", "Define clear governance jurisdiction."],
                "explanation": "[DEMO MODE - Simulated Contract Review]"
            }

        try:
            from mistralai.models.chat_completion import ChatMessage
            response = self.client.chat(
                model="mistral-tiny",
                messages=[ChatMessage(role="user", content=prompt)]
            )
            analysis = response.choices[0].message.content
            return {"contract_analysis": analysis, "status": "processed"}
        except Exception as e:
            return {"error": str(e), "status": "failed"}
