console.assert(
    process.env.OPENROUTER_API_KEY,
    "OPENROUTER_API_KEY environment variable is not set. Please set it in your .env file."
)

export type ModelConfig = {
    apiKey: string;
    httpReferer: string;
    xTitle: string;
    port: number;
    models: string[];
    temperature: number;
    maxTokens: number;
    systemPrompt: string;

    provider: {
        sort: {
            by: string;
            partition: string;
        }
    }
}

export const config: ModelConfig = {
    apiKey: process.env.OPENROUTER_API_KEY!,
    httpReferer: 'http://pos-ia.com',
    xTitle: 'Smart Model Router Gateway',
    port: 3000,
    models: [
        //Barato
        'google/lyria-3-clip-preview',
        'openai/gpt-oss-20b:free'
    ],
    temperature: 0.2,
    maxTokens: 2000,
    systemPrompt: 'You are a helpful assistant.',

    provider: {
        sort: {
            by: 'price',
            //by: 'throughput',
            //by: 'latency',
            partition: 'none'
        }
    }
}