import { Addressable } from "./Addressable";

export class Ram implements Addressable {
  private data: Uint8Array;

  constructor(size: number) {
    this.data = new Uint8Array(size);
  }

  public read(location: number): number {
    return this.data[location];
  }

  public write(location: number, data: number) {
    this.data[location] = data;
  }
}
