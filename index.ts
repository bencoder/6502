import { MemoryMap } from "./memorymap";
import { Processor } from "./processor";
import { Ram } from "./ram";
import { Rom } from "./rom";

const romData = new Uint8Array(0x8000);

//LDA 0x42
romData[0x0000] = 0xa9;
romData[0x0001] = 0x42;
romData[0x0002] = 0x02; //illegal opcode, halt

//reset vector, go to start of rom at 0x8000:
romData[0x7ffc] = 0x00;
romData[0x7ffd] = 0x80;

const ram = new Ram(0x8000);
const rom = new Rom(romData);
const memoryMap = new MemoryMap([
  { start: 0, end: 0x7fff, interface: ram },
  { start: 0x8000, end: 0xffff, interface: rom },
]);

const processor = new Processor(memoryMap);

processor.tick();
processor.tick();
