import { config } from "./config.ts";
import { OpenRouterService } from "./openRouterService.ts";
import { createServer } from "./server.ts";

const routerService = new OpenRouterService(config);
const app = createServer(routerService);

await app.listen({ port: 3000, host: '0.0.0.0' });

/*app.inject({
    method: 'POST',
    url: '/chat',
    body: { question: 'What is the capital of France?' },
}).then(response => {
    console.log('Response from /chat:', response.payload);
}).catch(error => {
    console.error('Error during request to /chat:', error);
});*/