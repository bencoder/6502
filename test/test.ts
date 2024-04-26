import { Processor } from "../Processor";
import { readFileSync } from "fs";
import { TestRam } from "./TestRam";

const ramData = readFileSync("./6502_functional_test.bin");
const ram = new TestRam(ramData);

const processor = new Processor(ram);
processor.setPC(0x0400);

//output debug data when the PC is between these values
const traceStart = 0x346f;
const traceEnd = 0x3500;

let cycles = 0;
const start = Date.now();
while (true) {
  const pcBefore = processor.getPC();
  cycles += processor.tick(pcBefore >= traceStart && pcBefore < traceEnd);
  if (processor.getPC() === pcBefore) {
    const timeSpent = Date.now() - start;
    const equivalentMhz = Math.floor(cycles / (timeSpent / 1000) / 1000) / 1000;
    console.log(
      `TRAPPED at ${pcBefore.toString(16)} after ${cycles} cycles and ${timeSpent}ms (${equivalentMhz}Mhz)`
    );
    const stack = ramData.subarray(0x100, 0x200);
    console.log(stack.toString("hex").match(/../g)?.join(" "));
    process.exit();
  }
}
