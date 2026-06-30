import { invokeSupabaseFunction } from "./supabaseFunctionService";

export async function askClaudeAssistant({
  message,
  history = [],
  role = "worker",
  activeView = "",
  profile = null,
}) {
  const cleanMessage = String(message || "").trim();

  if (!cleanMessage) {
    throw new Error("Please type a question first.");
  }

  const safeHistory = (history || [])
    .filter((item) => item?.text)
    .slice(-8)
    .map((item) => ({
      sender: item.sender === "user" ? "user" : "assistant",
      text: String(item.text || "").slice(0, 1200),
    }));

  const data = await invokeSupabaseFunction("ai-chat", {
    body: {
      message: cleanMessage,
      history: safeHistory,
      role,
      activeView,
      profile: profile
        ? {
            name: profile.full_name || profile.email || "",
            role: profile.role || role,
          }
        : null,
    },
  });

  return {
    text: String(data?.reply || "").trim(),
  };
}
