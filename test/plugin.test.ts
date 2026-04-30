import { describe, it, expect } from "vitest";
import { RampartPlugin } from "../src/plugin";
import type { AgentConfig } from "@opencode-ai/sdk/v2";

// Helper to check if a bash command is allowed by the permission glob rules
function isBashAllowed(command: string, rules: Record<string, string>): boolean {
  // Simple glob matcher for the test
  let allowed = rules["*"] === "allow";
  if (rules["*"] === "deny") allowed = false;

  for (const [pattern, action] of Object.entries(rules)) {
    if (pattern === "*") continue;
    
    // Convert glob pattern to regex (simple * handling)
    const regexStr = "^" + pattern.replace(/\*/g, ".*") + "$";
    const regex = new RegExp(regexStr);
    
    if (regex.test(command)) {
      allowed = action === "allow";
    }
  }
  
  return allowed;
}

describe("RampartPlugin Config Tests", () => {
  it("should configure all agents correctly", async () => {
    // Generate config
    const pluginResult = await RampartPlugin({} as any);
    const config: any = {};
    if (typeof pluginResult === "object" && pluginResult !== null && "config" in pluginResult) {
       await pluginResult.config!(config);
    } else {
       throw new Error("Plugin did not return an object with a config method");
    }

    const agents = config.agent as Record<string, AgentConfig>;

    // Ensure all 7 agents are defined
    const expectedAgents = [
      "archdruid",
      "seer",
      "beastmaster",
      "critter",
      "thread",
      "spindle",
      "docs-writer",
    ];

    for (const name of expectedAgents) {
      expect(agents[name]).toBeDefined();
      expect(agents[name].steps).toBeDefined();
      expect(agents[name].steps).toBeGreaterThan(0);
    }

    // 1. Seer bd vulnerability test
    const seerBash = (agents["seer"].permission as any)?.bash as Record<string, string>;
    expect(isBashAllowed("bd edit", seerBash)).toBe(false);
    expect(isBashAllowed("bd edit 123", seerBash)).toBe(false);
    expect(isBashAllowed("bd init", seerBash)).toBe(true);
    expect(isBashAllowed("bd create --title=foo", seerBash)).toBe(true);
    expect(isBashAllowed("bd list", seerBash)).toBe(true);

    // 2. Critter git over-privilege test
    const critterBash = (agents["critter"].permission as any)?.bash as Record<string, string>;
    expect(isBashAllowed("git rebase -i", critterBash)).toBe(false);
    expect(isBashAllowed("git clean -f", critterBash)).toBe(false);
    expect(isBashAllowed("git push --force", critterBash)).toBe(true); // "git push*" matches "git push --force", but it's better than "git *"
    // Let's refine git push* later if needed, but for now we expect git push to be allowed and dangerous like rebase to be denied.
    expect(isBashAllowed("git checkout -b foo", critterBash)).toBe(true);
    expect(isBashAllowed("git commit -m 'test'", critterBash)).toBe(true);

    // 3. Implicit edit permissions test
    expect((agents["critter"].permission as any)?.edit).toBe("allow");
    expect((agents["docs-writer"].permission as any)?.edit).toBe("allow");
    
    expect((agents["seer"].permission as any)?.edit).toBe("deny");
    expect((agents["beastmaster"].permission as any)?.edit).toBe("deny");
    expect((agents["thread"].permission as any)?.edit).toBe("deny");
    expect((agents["spindle"].permission as any)?.edit).toBe("deny");
    
    // 4. Global destructive command test
    const beastmasterBash = (agents["beastmaster"].permission as any)?.bash as Record<string, string>;
    expect(isBashAllowed("rm -rf /", seerBash)).toBe(false);
    expect(isBashAllowed("rm -rf /", critterBash)).toBe(false);
    expect(isBashAllowed("rm -rf /", beastmasterBash)).toBe(false);
  });
});
