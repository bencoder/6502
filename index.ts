import { ConsoleIO } from "./ConsoleIO";
import { MemoryMap } from "./memorymap";
import { Processor } from "./processor";
import { Ram } from "./ram";
import { Rom } from "./rom";

const romData = new Uint8Array(0x8000);

//START:
//LDA 0x7000
romData[0x0000] = 0xad;
romData[0x0001] = 0x00;
romData[0x0002] = 0x70;

//BEQ START
romData[0x0003] = 0xf0;
romData[0x0004] = -5;

//TAX
romData[0x0005] = 0xaa;

//SEC //set carry, so the subtract works as expected
romData[0x0006] = 0x38;

//SBC 0x20 //0x20 = first printable character - space
romData[0x0007] = 0xe9;
romData[0x0008] = 0x20;

//BMI ENDLINE //jump to ENDLINE if character read was less than 0x20
romData[0x0009] = 0x30;
romData[0x000a] = 0x07;

//INX
romData[0x000b] = 0xe8;

//STX 0x7000 //output character incremented by 1
romData[0x000c] = 0x8e;
romData[0x000d] = 0x00;
romData[0x000e] = 0x70;

//JMP START
romData[0x000f] = 0x4c;
romData[0x0010] = 0x00;
romData[0x0011] = 0x80;

//ENDLINE:  //Print CRLF
//LDA #0x0A //CR
romData[0x0012] = 0xa9;
romData[0x0013] = 0x0d;
//STA 0x7000
romData[0x0014] = 0x8d;
romData[0x0015] = 0x00;
romData[0x0016] = 0x70;

//LDA #0x0D //LF
romData[0x0017] = 0xa9;
romData[0x0018] = 0x0a;
//STA 0x7000
romData[0x0019] = 0x8d;
romData[0x001a] = 0x00;
romData[0x001b] = 0x70;
//JMP START
romData[0x001c] = 0x4c;
romData[0x001d] = 0x00;
romData[0x001e] = 0x80;

//reset vector, go to start of rom at 0x8000:
romData[0x7ffc] = 0x00;
romData[0x7ffd] = 0x80;

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
