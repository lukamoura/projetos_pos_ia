import test from "node:test"
import assert from "node:assert/strict"
import { createServer } from "../src/server.ts";
import { config } from "../src/config.ts";
import { type LLMResponse, OpenRouterService } from "../src/openRouterService.ts";

console.assert(
    process.env.OPENROUTER_API_KEY,
    "OPENROUTER_API_KEY environment variable is not set. Please set it in your .env file."
)

test.todo("routes to cheapest model by default", async () => {
    const customConfig = {
        ...config,
        provider: {
            ...config.provider,
            sort: {
                ...config.provider.sort,
                by: 'price'
            }
        }
    }
    
    const routerService = new OpenRouterService(customConfig);
    const app = createServer(routerService);

    const response = await app.inject({
        method: 'POST',
        url: '/chat',
        body: { question: 'What is the capital of France?' },
    })
    assert.equal(response.statusCode, 200);
    const body = response.json() as LLMResponse;

    assert.equal(body.model, 'google/lyria-3-clip-preview');
})
test.todo("routes to highest throughput model by default");