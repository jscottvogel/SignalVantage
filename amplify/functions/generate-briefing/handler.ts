import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";

const client = new BedrockRuntimeClient({ region: process.env.AWS_REGION });

export const handler = async (event: any) => {
    const { prompt } = event.arguments;

    if (!prompt) {
        throw new Error("Prompt is required");
    }

    const modelId = "anthropic.claude-3-haiku-20240307-v1:0";

    const payload = {
        anthropic_version: "bedrock-2023-05-31",
        max_tokens: 2000,
        messages: [
            {
                role: "user",
                content: [
                    {
                        type: "text",
                        text: prompt,
                    },
                ],
            },
        ],
    };

    try {
        const command = new InvokeModelCommand({
            modelId,
            contentType: "application/json",
            accept: "application/json",
            body: JSON.stringify(payload),
        });

        const response = await client.send(command);
        const decodedResponseBody = new TextDecoder().decode(response.body);
        const responseBody = JSON.parse(decodedResponseBody);

        // Claude 3 response structure
        const generatedText = responseBody.content[0].text;

        try {
            // Strategy 1: Look for markdown code block explicitly
            const updatedText = generatedText.trim();
            const markdownMatch = updatedText.match(/```json\s*([\s\S]*?)\s*```/);

            let textToParse = "";
            if (markdownMatch && markdownMatch[1]) {
                textToParse = markdownMatch[1];
            } else {
                // Strategy 2: Look for first { to last }
                const jsonMatch = updatedText.match(/\{[\s\S]*\}/);
                textToParse = jsonMatch ? jsonMatch[0] : updatedText;
            }

            const parsed = JSON.parse(textToParse);
            return {
                summary: parsed.summary || "",
                narrative: parsed.narrative || generatedText
            };
        } catch (e) {
            console.log("Failed to parse JSON response. Error:", e);
            console.log("Content was:", generatedText);

            // Fallback: If it looks like JSON but failed (e.g. unescaped newlines), 
            // we might be able to salvage it or just return raw.
            // For now, return raw but maybe the UI can handle it better if we flag it.
            return {
                summary: "",
                narrative: generatedText
            };
        }

    } catch (error) {
        console.error("Error invoking Bedrock:", error);
        throw new Error("Failed to generate briefing");
    }
};
