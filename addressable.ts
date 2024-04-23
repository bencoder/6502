export interface Addressable {
  read(location: number): number;
  write(location: number, data: number): void;
}
