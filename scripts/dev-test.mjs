import { spawn } from "node:child_process";

process.loadEnvFile(".env.test");
console.log(`\n  🧪 TEST database: ${process.env.NEXT_PUBLIC_SUPABASE_URL}\n`);

const next = spawn("next", ["dev", ...process.argv.slice(2)], { stdio: "inherit", shell: true });
next.on("exit", (code) => process.exit(code ?? 0));
