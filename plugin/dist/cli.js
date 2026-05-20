#!/usr/bin/env node
// sdlc-audit — CI-mode SDLC audit runner
//
// Usage:
//   sdlc-audit [--stages=1,4,8] [--fail-on=FAIL,CONCERNS] [--format=json|text]
//
// Exit codes:
//   0 — all audited stages clean
//   1 — CONCERNS found (only when CONCERNS is in --fail-on)
//   2 — FAIL found, or unrecoverable error
import { readState, runGateSynthesis, FRAMEWORK_VERSION } from "./state.js";
import { resolveProjectRoot } from "./sdlc.js";
import { verifyState } from "./integrity.js";
function parseArgs(argv) {
    const stages = (() => {
        const a = argv.find((x) => x.startsWith("--stages="));
        if (!a)
            return null;
        return a.split("=")[1].split(",").map(Number).filter((n) => !isNaN(n));
    })();
    const failOnRaw = argv.find((x) => x.startsWith("--fail-on="))?.split("=")[1] ?? "FAIL";
    const failOn = new Set(failOnRaw.split(",").map((s) => s.trim().toUpperCase()));
    const format = argv.find((x) => x.startsWith("--format="))?.split("=")[1] === "json" ? "json" : "text";
    const projectRoot = argv.find((x) => x.startsWith("--project-root="))?.split("=")[1];
    return { stages, failOn, format, projectRoot };
}
async function main() {
    const { stages, failOn, format, projectRoot } = parseArgs(process.argv.slice(2));
    const root = resolveProjectRoot(projectRoot);
    let state;
    try {
        state = readState(root);
    }
    catch (err) {
        if (format === "json") {
            process.stdout.write(JSON.stringify({ error: String(err) }, null, 2) + "\n");
        }
        else {
            process.stderr.write(`ERROR: ${String(err)}\n`);
        }
        process.exit(2);
    }
    const integrity = verifyState(state, root);
    const results = [];
    for (const [stageKey, stageConfig] of Object.entries(state.stages)) {
        const stageNum = parseInt(stageKey, 10);
        if (stages && !stages.includes(stageNum))
            continue;
        const stageHistory = state.history.filter((h) => h.stage === stageNum);
        const histEntry = stageHistory[stageHistory.length - 1];
        if (histEntry) {
            results.push({
                stage: stageNum,
                name: histEntry.name,
                verdict: histEntry.gate,
                score: histEntry.score,
                concerns: histEntry.concerns,
            });
        }
        else if (state.cursor.stage === stageNum) {
            const synthesis = runGateSynthesis(stageConfig);
            results.push({
                stage: stageNum,
                name: stageConfig.name,
                verdict: synthesis.verdict,
                score: synthesis.score,
                concerns: synthesis.concerns,
                failed_criteria: synthesis.failed_criteria,
                human_judgment_ns: synthesis.human_judgment_ns,
            });
        }
        else {
            results.push({ stage: stageNum, name: stageConfig.name, verdict: "NOT_STARTED", score: 0 });
        }
    }
    const summary = {
        total: results.length,
        pass: results.filter((r) => ["PASSED", "PASS"].includes(r.verdict)).length,
        concerns: results.filter((r) => ["PASSED_WITH_CONCERNS", "CONCERNS"].includes(r.verdict)).length,
        fail: results.filter((r) => ["FAIL", "FAILED"].includes(r.verdict)).length,
        human_judgment: results.filter((r) => r.verdict === "HUMAN_JUDGMENT").length,
        not_run: results.filter((r) => ["NOT_STARTED", "BLOCKED"].includes(r.verdict)).length,
    };
    const output = {
        framework_version: FRAMEWORK_VERSION,
        project_root: root,
        audited_at: new Date().toISOString(),
        results,
        summary,
    };
    if (format === "json") {
        process.stdout.write(JSON.stringify(output, null, 2) + "\n");
    }
    else {
        process.stdout.write(`SDLC Audit — ${root}\nFramework v${FRAMEWORK_VERSION} | ${output.audited_at}\n`);
        if (!integrity.ok)
            process.stderr.write(`\n⚠ INTEGRITY:\n${integrity.errors.join("\n")}\n`);
        process.stdout.write(`\n${"─".repeat(60)}\n`);
        for (const r of results) {
            const bar = r.score > 0 ? ` [${r.score}/100]` : "";
            process.stdout.write(`Stage ${r.stage.toString().padStart(2)} | ${r.name.padEnd(35)} | ${r.verdict}${bar}\n`);
            if (r.failed_criteria?.length)
                for (const c of r.failed_criteria)
                    process.stdout.write(`    ✗ ${c}\n`);
            if (r.concerns?.length)
                for (const c of r.concerns)
                    process.stdout.write(`    ⚠ ${c}\n`);
        }
        process.stdout.write(`${"─".repeat(60)}\n`);
        process.stdout.write(`Total: ${summary.total} | PASS: ${summary.pass} | CONCERNS: ${summary.concerns} | FAIL: ${summary.fail}` +
            (summary.human_judgment > 0 ? ` | HUMAN_JUDGMENT: ${summary.human_judgment}` : "") + "\n");
    }
    if (!integrity.ok)
        process.exit(2);
    const hasHardFail = results.some((r) => failOn.has(r.verdict.toUpperCase()) || (r.verdict === "FAILED" && failOn.has("FAIL")));
    const hasConcerns = failOn.has("CONCERNS") &&
        results.some((r) => r.verdict === "CONCERNS" || r.verdict === "PASSED_WITH_CONCERNS");
    if (hasHardFail)
        process.exit(2);
    if (hasConcerns)
        process.exit(1);
    process.exit(0);
}
main().catch((err) => {
    process.stderr.write(`Fatal: ${String(err)}\n`);
    process.exit(2);
});
//# sourceMappingURL=cli.js.map