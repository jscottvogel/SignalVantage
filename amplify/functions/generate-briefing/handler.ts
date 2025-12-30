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

        let summary = "";
        let narrative = generatedText;

        try {
            if (generatedText.includes("###SECTION_SPLIT###")) {
                const parts = generatedText.split("###SECTION_SPLIT###");
                summary = parts[0].replace(/EXECUTIVE_SUMMARY/i, "").trim();
                narrative = parts[1].replace(/EXECUTIVE_NARRATIVE/i, "").trim();
            } else {
                // Legacy/Fallback JSON attempt
                const jsonMatch = generatedText.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    const parsed = JSON.parse(jsonMatch[0]);
                    summary = parsed.summary || "";
                    narrative = parsed.narrative || generatedText;
                }
            }
        } catch (e) {
            console.log("Parsing failed, returning raw text.", e);
        }

        return {
            summary,
            narrative
        };

    } catch (error) {
        console.error("Error invoking Bedrock:", error);
        throw new Error("Failed to generate briefing");
    }
};
