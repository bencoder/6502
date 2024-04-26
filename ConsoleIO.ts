import { Addressable } from "./Addressable";

export class ConsoleIO implements Addressable {
  private inputBuffer: string = "";

  constructor() {
    process.stdin.setEncoding("ascii");
    process.stdin.setRawMode(true);
    process.stdin.on("data", (data) => {
      //handle ctrl+c
      if (data.toString() == "\u0003") {
        process.exit();
      }
      this.inputBuffer += data.toString();
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
