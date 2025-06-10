import "./assets/main.css";
import { createApp } from "vue";
import App from "./App.vue";
import router from "./router";
import { Amplify } from "aws-amplify";
import { generateClient } from "aws-amplify/data";
import { setupAmplifyDebugging } from "./utils/amplify-debug";
import type { Schema } from "../amplify/data/resource";

try {
  const outputs = await import("../amplify_outputs.json");
  Amplify.configure(outputs.default);
  
  // Enable debugging and expose client in development
  if (import.meta.env.DEV) {
    setupAmplifyDebugging();
    
    // Expose Amplify client for E2E tests
    const client = generateClient<Schema>();
    (window as any).amplifyClient = client;
    (window as any).client = client; // Alias for simpler access
    console.log('Amplify client exposed on window for E2E testing');
  }
} catch (error) {
  console.warn("amplify_outputs.json not found. Run 'npx ampx sandbox' to generate it.");
}

const app = createApp(App);
app.use(router);
app.mount("#app");
