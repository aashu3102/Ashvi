import type { TaskComplexity, TaskIntent, TaskPlan, TaskStep } from "./types.js";

export function planTask(prompt: string, intent: TaskIntent, complexity: TaskComplexity): TaskPlan {
  // Fast path for simple requests: 1 direct step, 0 extra model calls or planning latency
  if (complexity === "simple") {
    return {
      type: "direct",
      steps: [
        {
          id: "step_direct_1",
          description: `Direct response for ${intent.replace(/_/g, " ")}`,
          action: "generate_response",
          status: "pending",
        },
      ],
    };
  }

  // Complex requests: analyze sequential steps or decompose by intent
  const steps = decomposeSteps(prompt, intent);

  return {
    type: "multi_step",
    steps,
  };
}

function decomposeSteps(prompt: string, intent: TaskIntent): TaskStep[] {
  const stepMatches: string[] = [];

  // Pattern: Step 1: ..., Step 2: ... or 1. ... 2. ...
  const stepRegex = /(?:step\s*\d+|[1-9]\.)\s*[:.-]?\s*(.*?)(?=(?:step\s*\d+|[1-9]\.|$))/gis;
  let match: RegExpExecArray | null;
  while ((match = stepRegex.exec(prompt)) !== null) {
    const text = match[1]?.replace(/[.\s]+$/, "").trim();
    if (text && text.length > 3) {
      stepMatches.push(text);
    }
  }

  // Pattern: "first ... then ... finally ..."
  if (stepMatches.length === 0) {
    const seqMatch = prompt.match(/\bfirst(?:ly)?\b\s*[:,-]?\s*([^,\n]+)[\s\S]*?\bthen\b\s*[:,-]?\s*([^,\n]+)[\s\S]*?\bfinally\b\s*[:,-]?\s*([^.\n]+)/i);
    if (seqMatch) {
      stepMatches.push(seqMatch[1].trim(), seqMatch[2].trim(), seqMatch[3].trim());
    }
  }

  if (stepMatches.length >= 2) {
    return stepMatches.map((desc, idx) => ({
      id: `step_${idx + 1}`,
      description: desc,
      action: idx === 0 ? "analyze_input" : idx === stepMatches.length - 1 ? "synthesize_final" : "execute_intermediate",
      status: "pending",
    }));
  }

  // Fallback domain-driven decomposition based on intent
  switch (intent) {
    case "coding":
      return [
        {
          id: "step_code_1",
          description: "Analyze code requirements and architecture constraints",
          action: "analyze_requirements",
          status: "pending",
        },
        {
          id: "step_code_2",
          description: "Implement code solution with type safety and error handling",
          action: "generate_code",
          status: "pending",
        },
        {
          id: "step_code_3",
          description: "Verify edge cases and document usage instructions",
          action: "verify_solution",
          status: "pending",
        },
      ];

    case "document_analysis":
      return [
        {
          id: "step_doc_1",
          description: "Extract and cross-reference relevant citations from document evidence",
          action: "extract_citations",
          status: "pending",
        },
        {
          id: "step_doc_2",
          description: "Synthesize document findings addressing user inquiry",
          action: "synthesize_analysis",
          status: "pending",
        },
      ];

    case "research":
      return [
        {
          id: "step_res_1",
          description: "Explore core concepts, conflicting theories, and empirical evidence",
          action: "gather_evidence",
          status: "pending",
        },
        {
          id: "step_res_2",
          description: "Synthesize findings into structured, balanced research summary",
          action: "synthesize_research",
          status: "pending",
        },
      ];

    case "data_analysis":
      return [
        {
          id: "step_data_1",
          description: "Inspect metrics, distributions, and anomalies",
          action: "inspect_data",
          status: "pending",
        },
        {
          id: "step_data_2",
          description: "Formulate statistical insights, trends, and conclusions",
          action: "generate_insights",
          status: "pending",
        },
      ];

    default:
      return [
        {
          id: "step_gen_1",
          description: "Deconstruct multi-part inquiry into constituent requirements",
          action: "decompose_inquiry",
          status: "pending",
        },
        {
          id: "step_gen_2",
          description: "Synthesize comprehensive response fulfilling all parts",
          action: "synthesize_response",
          status: "pending",
        },
      ];
  }
}
