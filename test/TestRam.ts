import { Addressable } from "../Addressable";

export class TestRam implements Addressable {
  private data: Uint8Array;

  constructor(data: Uint8Array) {
    this.data = data;
  }

  public read(location: number): number {
    return this.data[location];
  }

  public write(location: number, data: number) {
    this.data[location] = data;
  }
}
