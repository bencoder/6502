import { Addressable } from "./addressable";

export class Rom implements Addressable {
  constructor(private data: Uint8Array) {}

  public read(location: number): number {
    return this.data[location];
  }

  public write(location: number, data: number) {}
}
