from typing import Dict, Any

class HiringCopilotAgent:
    def __init__(self, mistral_client=None):
        self.client = mistral_client

    def evaluate_candidate(self, resume_text: str, job_description: str) -> Dict[str, Any]:
        """
        Evaluates a candidate's resume against a job description.
        """
        prompt = (
            f"You are an AI Hiring Copilot. Evaluate this candidate based on their resume and target Job Description.\n\n"
            f"--- Job Description ---\n{job_description}\n\n"
            f"--- Candidate Resume ---\n{resume_text}\n\n"
            f"Provide a structured analysis returning:\n"
            f"1. Overall Compatibility Score (0 to 100)\n"
            f"2. Core Strengths matched\n"
            f"3. Skills gaps identified\n"
            f"4. Recommended screening questions"
        )

        if not self.client:
            # Simulated response for testing without API keys
            return {
                "score": 85,
                "strengths": ["Strong alignment with required tech stack", "Relevant experience in tech sectors"],
                "gaps": ["Missing explicit certification matching target role details"],
                "questions": ["Can you detail your experience building scalable REST microservices?", "How did you manage vector embeddings?"],
                "explanation": "[DEMO MODE - Simulated Analysis]"
            }

        try:
            from mistralai.models.chat_completion import ChatMessage
            response = self.client.chat(
                model="mistral-tiny",
                messages=[ChatMessage(role="user", content=prompt)]
            )
            analysis = response.choices[0].message.content
            return {"evaluation": analysis, "status": "processed"}
        except Exception as e:
            return {"error": str(e), "status": "failed"}
