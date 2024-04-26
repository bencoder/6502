import { Processor } from "../Processor";
import { readFileSync } from "fs";
import { TestRam } from "./TestRam";

const ramData = readFileSync("./6502_functional_test.bin");
const ram = new TestRam(ramData);

const processor = new Processor(ram);
processor.setPC(0x0400);

const startTime = Date.now();
let cyclesSinceStart = 0;
let hz = 1000000;
const interval = setInterval(() => {
  const secondsElapsed = (Date.now() - startTime) / 1000;
  const totalExpectedCycles = secondsElapsed * hz;
  while (cyclesSinceStart < totalExpectedCycles) {
    const pcBefore = processor.getPC();
    cyclesSinceStart += processor.tick(true);
    if (processor.getPC() === pcBefore) {
      console.log("TRAPPED");
      const stack = ramData.subarray(0x100, 0x200);
      console.log(stack.toString("hex").match(/../g)?.join(" "));
      process.exit();
    }
  }
}, 1);

process.on("beforeExit", () => {});
