const MOCK_DELAY_MS = 900;

function buildMockAnswer(prompt, model) {
    return [
        "Mock backend response",
        `Model: ${model || "gemini-2.5-flash"}`,
        "",
        `Prompt received: "${prompt}"`,
        "",
        "This route is a placeholder for the Python Gemini backtesting service.",
        "When the backend is ready, keep the same request body shape and replace this mock answer with the real server result.",
    ].join("\n");
}

export async function POST(request) {
    try {
        const { prompt, model } = await request.json();

        if (typeof prompt !== "string" || !prompt.trim()) {
            return Response.json(
                { error: "A non-empty prompt is required." },
                { status: 400 }
            );
        }

        await new Promise((resolve) => setTimeout(resolve, MOCK_DELAY_MS));

        return Response.json({
            answer: buildMockAnswer(prompt.trim(), model),
        });
    } catch {
        return Response.json(
            { error: "Invalid request payload." },
            { status: 400 }
        );
    }
}
