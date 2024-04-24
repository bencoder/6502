import { Addressable } from "./addressable";
import * as readline from "readline";

export class ConsoleIO implements Addressable {
  private rl: readline.Interface;
  private inputBuffer: string = "";

  constructor() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: false,
    });
    this.rl.on("line", (input) => {
      this.inputBuffer = this.inputBuffer + input + String.fromCharCode(0x0d);
    });
  }

  public read(location: number): number {
    if (this.inputBuffer.length == 0) {
      return 0;
    }
    const result = this.inputBuffer.charCodeAt(0);
    this.inputBuffer = this.inputBuffer.slice(1);
    return result & 0xff;
  }

  public write(location: number, data: number): void {
    process.stdout.write(String.fromCharCode(data));
  }
}
