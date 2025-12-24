import 'dotenv/config';
import { Template, defaultBuildLogger } from 'e2b';
import { template } from './lib/template';

async function main() {
  await Template.build(template, {
    alias: "react-app-template",
    cpuCount: 1,
    memoryMB: 1024,
    onBuildLogs: defaultBuildLogger(),
  });
}

main().catch(console.error);