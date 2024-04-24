import { Addressable } from "./Addressable";

interface MemoryPart {
  start: number;
  end: number;
  interface: Addressable;
}

export class MemoryMap implements Addressable {
  constructor(private memoryParts: MemoryPart[]) {}

  read(location: number): number {
    for (const part of this.memoryParts) {
      if (location >= part.start && location <= part.end) {
        return part.interface.read(location - part.start);
      }
    }
    return 0x00; //if nothing attached to this memory location
  }

  write(location: number, data: number): void {
    for (const part of this.memoryParts) {
      if (location >= part.start && location <= part.end) {
        part.interface.write(location - part.start, data);
      }
    }
  }
}
