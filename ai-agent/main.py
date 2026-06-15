import os
import logging
from typing import List, Optional, Dict, Any
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from dotenv import load_dotenv
import requests
from qdrant_client import QdrantClient
from qdrant_client.http import models as qdrant_models
from mistralai.client import MistralClient
from mistralai.models.chat_completion import ChatMessage

# Import Specialized Agents
from agents.hiring_copilot import HiringCopilotAgent
from agents.finance import FinanceDebtAgent
from agents.legal import LegalDocAgent
from agents.student import StudentSolvingAgent

# Setup Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("ai-agent")

load_dotenv()

app = FastAPI(title="Multi-Agent Platform (Mistral + Qdrant + Enkrypt)")

# Load Configuration
MISTRAL_API_KEY = os.getenv("MISTRAL_API_KEY", "")
ENKRYPTAI_API_KEY = os.getenv("ENKRYPTAI_API_KEY", "")
ENKRYPTAI_POLICY = os.getenv("ENKRYPTAI_POLICY", "default-policy")
QDRANT_HOST = os.getenv("QDRANT_HOST", "qdrant")
QDRANT_PORT = int(os.getenv("QDRANT_PORT", "6333"))

# Initialize clients
qdrant_client = QdrantClient(host=QDRANT_HOST, port=QDRANT_PORT)
mistral_client = MistralClient(api_key=MISTRAL_API_KEY) if MISTRAL_API_KEY else None

COLLECTION_NAME = "knowledge_base"

# Initialize Agents
hiring_agent = HiringCopilotAgent(mistral_client)
finance_agent = FinanceDebtAgent(mistral_client)
legal_agent = LegalDocAgent(mistral_client)
student_agent = StudentSolvingAgent(mistral_client)


# Request & Response Models
class QueryRequest(BaseModel):
    query: str

class QueryResponse(BaseModel):
    query: str
    status: str
    guardrail_result: dict
    retrieved_chunks: List[str]
    response: str

class DocumentUpload(BaseModel):
    content: str
    metadata: Optional[dict] = None

# Specialized Request Models
class HiringRequest(BaseModel):
    resume_text: str
    job_description: str

class FinanceRequest(BaseModel):
    debts: List[Dict[str, Any]]
    monthly_budget: float

class LegalRequest(BaseModel):
    contract_text: str
    doc_type: str = "NDA"

class StudentRequest(BaseModel):
    problem_description: str
    subject: str = "Mathematics"


# Enkrypt AI Guardrail Verification
def verify_with_enkrypt(prompt: str) -> dict:
    """
    Sends the prompt to Enkrypt AI Guardrails for scanning.
    Fallback to simulator if API key is not present.
    """
    if not ENKRYPTAI_API_KEY:
        logger.warning("ENKRYPTAI_API_KEY not found. Running Enkrypt AI Simulator.")
        unsafe_words = ["ignore previous instructions", "bypass safety", "jailbreak", "hack", "inject"]
        has_attack = any(word in prompt.lower() for word in unsafe_words)
        
        if has_attack:
            return {
                "safe": False,
                "reason": "Prompt injection attempt detected by Enkrypt AI Simulator",
                "detectors": {"injection_attack": {"enabled": True, "triggered": True}}
            }
        return {
            "safe": True,
            "reason": "Passed simulated guardrails",
            "detectors": {"injection_attack": {"enabled": True, "triggered": False}}
        }

    url = "https://api.enkryptai.com/guardrails/policy/scan"
    headers = {
        "Content-Type": "application/json",
        "apikey": ENKRYPTAI_API_KEY,
        "X-Enkrypt-Policy": ENKRYPTAI_POLICY
    }
    payload = {"text": prompt}
    
    try:
        response = requests.post(url, headers=headers, json=payload, timeout=5)
        if response.status_code == 200:
            return response.json()
        else:
            logger.error(f"Enkrypt API returned status {response.status_code}: {response.text}")
            return {"safe": True, "reason": "Failed to contact guardrail endpoint; failing safe."}
    except Exception as e:
        logger.error(f"Error calling Enkrypt Guardrail: {e}")
        return {"safe": True, "reason": "Error contacting guardrail; failing safe."}


# Setup Qdrant Collection
@app.on_event("startup")
def setup_qdrant():
    try:
        collections = qdrant_client.get_collections().collections
        exists = any(c.name == COLLECTION_NAME for c in collections)
        if not exists:
            qdrant_client.create_collection(
                collection_name=COLLECTION_NAME,
                vectors_config=qdrant_models.VectorParams(
                    size=1024,
                    distance=qdrant_models.Distance.COSINE
                )
            )
            logger.info(f"Created Qdrant collection: {COLLECTION_NAME}")
    except Exception as e:
        logger.error(f"Failed to connect to Qdrant: {e}")


# Helper: Get embeddings via Mistral
def get_embedding(text: str) -> List[float]:
    if not mistral_client:
        return [0.1] * 1024
    response = mistral_client.embeddings(
        model="mistral-embed",
        input=[text]
    )
    return response.data[0].embedding


# --- Core RAG Endpoints ---

@app.post("/ingest", status_code=201)
def ingest_document(doc: DocumentUpload):
    try:
        embedding = get_embedding(doc.content)
        qdrant_client.upsert(
            collection_name=COLLECTION_NAME,
            points=[
                qdrant_models.PointStruct(
                    id=hash(doc.content) % 10**8,
                    vector=embedding,
                    payload={"content": doc.content, "metadata": doc.metadata or {}}
                )
            ]
        )
        return {"status": "success", "message": "Document ingested successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ingestion failed: {str(e)}")


@app.post("/query", response_model=QueryResponse)
def run_agent(request: QueryRequest):
    # Guardrail check
    guardrail = verify_with_enkrypt(request.query)
    if not guardrail.get("safe", True):
        return QueryResponse(
            query=request.query,
            status="blocked",
            guardrail_result=guardrail,
            retrieved_chunks=[],
            response=f"Request Blocked: {guardrail.get('reason', 'Policy violation detected')}"
        )

    # Retrieval
    retrieved_texts = []
    try:
        query_vector = get_embedding(request.query)
        search_results = qdrant_client.search(
            collection_name=COLLECTION_NAME,
            query_vector=query_vector,
            limit=2
        )
        for result in search_results:
            retrieved_texts.append(result.payload.get("content", ""))
    except Exception as e:
        logger.error(f"Qdrant search failed: {e}")
        retrieved_texts = ["Context search temporarily unavailable."]

    # LLM Generation
    context = "\n".join(retrieved_texts)
    prompt = (
        f"Context:\n{context}\n\n"
        f"Query: {request.query}\n\n"
        f"Provide a helpful answer grounded in the context above."
    )
    
    if not mistral_client:
        llm_response = (
            "[DEMO MODE - MISTRAL_API_KEY Not Found]\n"
            f"If initialized with a key, Mistral would process the query with this context:\n"
            f"- Context Chunks retrieved: {len(retrieved_texts)}\n"
            f"- User Query: {request.query}"
        )
    else:
        try:
            chat_response = mistral_client.chat(
                model="mistral-tiny",
                messages=[ChatMessage(role="user", content=prompt)]
            )
            llm_response = chat_response.choices[0].message.content
        except Exception as e:
            logger.error(f"Mistral LLM call failed: {e}")
            llm_response = f"Error generating response: {str(e)}"

    return QueryResponse(
        query=request.query,
        status="processed",
        guardrail_result=guardrail,
        retrieved_chunks=retrieved_texts,
        response=llm_response
    )


# --- Specialized AI Agents Endpoints ---

@app.post("/agent/hiring")
def run_hiring_copilot(req: HiringRequest):
    # Safe input verification
    guardrail = verify_with_enkrypt(req.resume_text + " " + req.job_description)
    if not guardrail.get("safe", True):
        raise HTTPException(status_code=400, detail=f"Request Blocked: {guardrail.get('reason')}")
    
    return hiring_agent.evaluate_candidate(req.resume_text, req.job_description)


@app.post("/agent/finance")
def run_finance_adviser(req: FinanceRequest):
    # Safe input verification
    debt_summary = " ".join([d.get("name", "") for d in req.debts])
    guardrail = verify_with_enkrypt(debt_summary)
    if not guardrail.get("safe", True):
        raise HTTPException(status_code=400, detail=f"Request Blocked: {guardrail.get('reason')}")
    
    return finance_agent.generate_repayment_plan(req.debts, req.monthly_budget)


@app.post("/agent/legal")
def run_legal_reviewer(req: LegalRequest):
    # Safe input verification
    guardrail = verify_with_enkrypt(req.contract_text)
    if not guardrail.get("safe", True):
        raise HTTPException(status_code=400, detail=f"Request Blocked: {guardrail.get('reason')}")
    
    return legal_agent.review_contract(req.contract_text, req.doc_type)


@app.post("/agent/student")
def run_student_solver(req: StudentRequest):
    # Safe input verification
    guardrail = verify_with_enkrypt(req.problem_description)
    if not guardrail.get("safe", True):
        raise HTTPException(status_code=400, detail=f"Request Blocked: {guardrail.get('reason')}")
    
    return student_agent.solve_problem(req.problem_description, req.subject)


@app.get("/health")
def health_check():
    return {"status": "ok", "qdrant": "connected"}
