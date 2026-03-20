#!/usr/bin/env node
import { Command } from "commander";

const program = new Command();
program.name("forgesync").description("ForgeSync CLI").version("0.1.0");

program.command("init").description("Link current repo to a ForgeSync project").action(() => {
  console.log("init: TODO");
});

program.command("start").description("Start an agent session").action(() => {
  console.log("start: TODO");
});

program.command("end").description("End an agent session").action(() => {
  console.log("end: TODO");
});

program.command("run").argument("<agent>").description("Run wrapped agent session").action((agent) => {
  console.log(`run ${agent}: TODO`);
});

program.command("status").description("Show active sessions + locks + decisions").action(() => {
  console.log("status: TODO");
});

program.parse();