import Anthropic from "@anthropic-ai/sdk";

export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

export interface ToolResult {
  tool_use_id: string;
  content: string;
}

export interface ToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface LlmResponse {
  content: Array<
    | { type: "text"; text: string }
    | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
  >;
  stop_reason: string;
}

export type ToolHandler = (
  name: string,
  input: Record<string, unknown>,
) => Promise<string>;

const client = new Anthropic();

export async function runToolLoop(
  systemPrompt: string,
  userMessage: string,
  tools: ToolDefinition[],
  handleTool: ToolHandler,
  maxIterations = 20,
): Promise<string> {
  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: userMessage },
  ];

  for (let i = 0; i < maxIterations; i++) {
    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 8192,
      system: systemPrompt,
      tools: tools.map((t) => ({
        name: t.name,
        description: t.description,
        input_schema: t.input_schema as Anthropic.Tool["input_schema"],
      })),
      messages,
    });

    // Collect text and tool calls
    const textParts: string[] = [];
    const toolCalls: ToolCall[] = [];

    for (const block of response.content) {
      if (block.type === "text") {
        textParts.push(block.text);
      } else if (block.type === "tool_use") {
        toolCalls.push({
          id: block.id,
          name: block.name,
          input: block.input as Record<string, unknown>,
        });
      }
    }

    // If no tool calls, we're done
    if (toolCalls.length === 0 || response.stop_reason === "end_turn") {
      // Check if there were tool calls in this final response
      if (toolCalls.length === 0) {
        return textParts.join("\n");
      }
    }

    // Execute tool calls and build tool results
    if (toolCalls.length > 0) {
      // Add assistant message with tool calls
      messages.push({ role: "assistant", content: response.content as any });

      // Execute each tool and collect results
      const toolResults: Anthropic.ToolResultBlockParam[] = [];
      for (const tc of toolCalls) {
        try {
          const result = await handleTool(tc.name, tc.input);
          toolResults.push({
            type: "tool_result",
            tool_use_id: tc.id,
            content: result,
          });
        } catch (err) {
          toolResults.push({
            type: "tool_result",
            tool_use_id: tc.id,
            content: `Error: ${err instanceof Error ? err.message : String(err)}`,
            is_error: true,
          });
        }
      }

      // Add tool results as user message
      messages.push({ role: "user", content: toolResults });
    } else if (response.stop_reason === "end_turn") {
      return textParts.join("\n");
    }
  }

  throw new Error("LLM tool loop exceeded maximum iterations");
}
