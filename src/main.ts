import "./assets/main.css";
import { createApp } from "vue";
import App from "./App.vue";
import router from "./router";
import { Amplify } from "aws-amplify";

try {
  const outputs = await import("../amplify_outputs.json");
  Amplify.configure(outputs.default);
} catch (error) {
  console.warn("amplify_outputs.json not found. Run 'npx ampx sandbox' to generate it.");
}

const app = createApp(App);
app.use(router);
app.mount("#app");
