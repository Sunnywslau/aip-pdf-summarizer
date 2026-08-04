import httpx
import os

DEEPSEEK_ENDPOINT = "https://api.deepseek.com/chat/completions"
GEMINI_ENDPOINT_TEMPLATE = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={key}"

SYSTEM_PROMPT = """You are an aviation operations expert. Summarize this AIP SUP / AIC document in a simple, clean, and highly scannable Markdown format.

Provide the summary using exactly these four sections, utilizing bold text, inline code, and formatting to highlight key information:
1. **Airport / Location**: State which airport(s) are affected. Use **bold** for airport names and `inline code` for ICAO/IATA codes (e.g., **Hong Kong International Airport** (`VHHH`)).
2. **Runway Impact**: State clearly "**YES**" or "**NO**". If YES, list the impacts using bullet points. Bold all runway designators (e.g., **RWY 07R/25L**) and dimensions/lengths (e.g., **2,500m**).
3. **Airspace Restriction**: State clearly "**YES**" or "**NO**". If YES, describe the airspace restrictions. Use `inline code` for altitudes/flight levels (e.g., `FL120` or `3,000ft AMSL`).
4. **Key Operational Summary & Dates**: Briefly summarize operational changes and effective dates/times. Use `inline code` for dates/times (e.g., `2026-06-07 to 2026-06-20`)."""


class SupAgent:
    """
    Processes AIP SUP / AIC documents by calling an LLM API server-side.
    Tries DeepSeek first (if key provided), then falls back to Gemini.
    All API calls originate from the Hugging Face server — bypassing
    regional restrictions (e.g. Hong Kong Gemini block) and corporate
    firewall rules on DeepSeek endpoints.
    """

    async def summarize(
        self,
        text: str,
        user_deepseek_key: str = None,
        user_gemini_key: str = None,
        system_prompt: str = None,
        model: str = None,
    ) -> str:
        prompt = system_prompt or SYSTEM_PROMPT

        # Prefer DeepSeek if key is supplied
        if user_deepseek_key:
            return await self._call_deepseek(
                text=text,
                api_key=user_deepseek_key,
                model=model or "deepseek-chat",
                system_prompt=prompt,
            )

        # Fall back to Gemini
        if user_gemini_key:
            return await self._call_gemini(
                text=text,
                api_key=user_gemini_key,
                model=model or "gemini-3.5-flash",
                system_prompt=prompt,
            )

        raise ValueError(
            "No API key provided. Supply either X-DeepSeek-API-Key or X-Gemini-API-Key header."
        )

    async def _call_deepseek(
        self, text: str, api_key: str, model: str, system_prompt: str
    ) -> str:
        payload = {
            "model": model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {
                    "role": "user",
                    "content": f"Analyze the following document and provide a summary:\n\n{text}",
                },
            ],
        }
        async with httpx.AsyncClient(timeout=120) as client:
            res = await client.post(
                DEEPSEEK_ENDPOINT,
                json=payload,
                headers={
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {api_key}",
                },
            )
        if not res.is_success:
            raise RuntimeError(f"DeepSeek API Error: {res.status_code} — {res.text}")
        return res.json()["choices"][0]["message"]["content"]

    async def _call_gemini(
        self, text: str, api_key: str, model: str, system_prompt: str
    ) -> str:
        endpoint = GEMINI_ENDPOINT_TEMPLATE.format(model=model, key=api_key)
        payload = {
            "contents": [{"parts": [{"text": f"Analyze the following document and provide a summary:\n\n{text}"}]}],
            "systemInstruction": {"parts": [{"text": system_prompt}]},
        }
        async with httpx.AsyncClient(timeout=120) as client:
            res = await client.post(
                endpoint,
                json=payload,
                headers={"Content-Type": "application/json"},
            )
        if not res.is_success:
            raise RuntimeError(f"Gemini API Error: {res.status_code} — {res.text}")
        return res.json()["candidates"][0]["content"]["parts"][0]["text"]
