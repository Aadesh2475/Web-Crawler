import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const { question, history = [], fileData } = await req.json();
  const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: 'No Gemini key' }, { status: 500 });

  // Build the user part — text + optional inline file data
  const userParts: object[] = [{ text: question }];

  if (fileData) {
    // fileData = { mimeType: 'image/png', base64: '...' }
    // or { mimeType: 'text/plain', text: '...' } for text files
    if (fileData.base64) {
      userParts.unshift({
        inlineData: { mimeType: fileData.mimeType, data: fileData.base64 },
      });
    } else if (fileData.text) {
      userParts.unshift({
        text: `[Attached file content — ${fileData.fileName}]:\n\`\`\`\n${fileData.text.slice(0, 8000)}\n\`\`\`\n\n`,
      });
    }
  }

  const contents = [
    ...history,
    { role: 'user', parts: userParts },
  ];

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents,
        systemInstruction: {
          parts: [{ text: 'You are SummyAI, an intelligent research assistant. Your primary goal is to provide concise, direct, and conversational answers. Do NOT regurgitate raw data, usernames, or database categories unless explicitly asked. Summarize the provided context intelligently into a clean, professional response. Format your answers with clear headings (##), bullet points where appropriate, and bold (**) for key terms. \n\nIMPORTANT DATA VISUALIZATION RULE: If the user asks you to plot, graph, or visualize data, you must return a valid JSON object wrapped in a markdown codeblock with the language "summy-chart". The JSON must match this structure: { "title": "Chart Name", "xKey": "name", "yKey": "value", "data": [{ "name": "Label", "value": 10 }] }. Do NOT include anything other than the JSON inside the codeblock.' }],
        },
        tools: [{ googleSearch: {} }],
      }),
    }
  );

  if (!res.ok) {
    const err = await res.json();
    return NextResponse.json({ error: err.error?.message ?? 'Gemini error' }, { status: 500 });
  }

  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? 'No response.';
  return NextResponse.json({ answer: text });
}
