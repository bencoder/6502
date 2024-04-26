import { ConsoleIO } from "./ConsoleIO";
import { MemoryMap } from "./MemoryMap";
import { Processor } from "./Processor";
import { Ram } from "./Ram";
import { Rom } from "./Rom";
import { readFileSync } from "fs";

const romData = readFileSync(process.argv[2] || "./roms/inc-chars");
const ram = new Ram(0x8000);
const rom = new Rom(romData);
const consoleIO = new ConsoleIO();

const memoryMap = new MemoryMap([
  { start: 0, end: 0x6fff, interface: ram },
  { start: 0x7000, end: 0x7fff, interface: consoleIO },
  { start: 0x8000, end: 0xffff, interface: rom },
]);

const processor = new Processor(memoryMap);

const startTime = Date.now();
let cyclesSinceStart = 0;
let hz = 1000000;
setInterval(() => {
  const secondsElapsed = (Date.now() - startTime) / 1000;
  const totalExpectedCycles = secondsElapsed * hz;
  while (cyclesSinceStart < totalExpectedCycles) {
    cyclesSinceStart += processor.tick();
  }
}, 1);
