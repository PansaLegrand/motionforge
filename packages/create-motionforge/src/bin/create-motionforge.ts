#!/usr/bin/env node
import { runCreateMotionforgeCli } from "../index.js";

process.exitCode = await runCreateMotionforgeCli(process.argv.slice(2));
