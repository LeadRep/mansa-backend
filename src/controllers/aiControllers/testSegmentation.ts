import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({
  // If you set GOOGLE_API_KEY env var, you can omit apiKey here.
  apiKey: process.env.GOOGLE_GEMINI_API_KEY,
});

function buildPrompt(lead: any) {
  return `
Classify this finance-industry lead into one or more asset classes:
- ETF
- EQUITIES
- FIXED_INCOME

Use the CRM DB data below and search on the internet (via Google Search grounding) for evidence 
that the lead is a finance-industry lead and wether he could be classified into one or more of the asset classes.

Return JSON only.

CRM DB data:
- Name: ${lead.first_name + " " + lead.last_name}
- Company: ${lead.organization.name ?? ""}
- LinkedIn: ${lead.linkedin_url ?? ""}
- Notes: ${lead.notes ?? ""}

Rules:
- Use the following JSON structure exactly. Do not remove or omit any fields. Output valid JSON only, no text or explanation.
  {
  "asset_classes": [ETF, FIXED_INCOME],
  "confidence": 0.8,
  "evidences": ["https://www.alianx.com/lennart+segler+allianz+global+investors", "https://www.google.com/search?q=lennart+segler+allianz+global+investors"],
  "notes": "Some notes about the classification"
  }
- Finding evidence on the public internet is the most important factor in the classification. The classification is for the individual not the company
- If you find a record on internet that unequivocally links the lead to one or more asset classes, return those in asset_classes with confidence=1.
- provide in the evidence a link to internet that justify your response
- If you find evidence that the lead is not a finance-industry lead, return asset_classes=[] and confidence=0.
`;
}

export async function aiClassifyLead(lead: any) {
  console.log("--- AI Request ---");
  console.log("Prompt:", buildPrompt(lead));
  const res = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: buildPrompt(lead),
    config: {
      // Enable web grounding with Google Search
      tools: [{ googleSearch: {} }], // docs: Grounding with Google Search :contentReference[oaicite:7]{index=7}

      // Force JSON output
      //responseMimeType: "application/json",

      // Enforce a schema (Structured Outputs)
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          asset_classes: {
            type: Type.ARRAY,
            items: { type: Type.STRING, enum: ["ETF", "EQUITIES", "FIXED_INCOME"] }
          },
          confidence: { type: Type.NUMBER, minimum: 0, maximum: 1 },
          evidence: { type: Type.ARRAY, items: { type: Type.STRING } },
          notes: { type: Type.STRING }
        },
        required: ["asset_classes", "confidence", "evidence"],
        // additionalProperties: false
      },

      temperature: 0.2,
    },
  });

  // With responseMimeType + schema, this should be valid JSON
  let text = await res.text!!;
  console.log("AI Response:", text);
  if (text.startsWith('```')) {
    text = text
      .replace(/^```(?:json)?/, '')
      .replace(/```$/, '')
      .trim();
  }
  if (!text) {
    throw new Error("Empty response from AI");
  }
  return JSON.parse(text);
}