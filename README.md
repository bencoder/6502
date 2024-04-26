# 6502 Emulator

Yet another 6502 emulator, in typescript.

## How to run

The easiest way is with ts-node

```
> npm install
> npm install -g ts-node
> ts-node index.ts roms/wozmon
```

## Roms

2 Roms are included in `roms/` directory, with their code in `programs/`.

- inc-chars
  - echos all characters typed to the screen, incremented by 1, quickly coded during emulator development to test it
- wozmon
  - The classic software by Woz, adapted for this emulator

## Memory map

The memory map is currently pretty simple:

| Addresses | Interface | Notes                                                                                                                       |
| --------- | --------- | --------------------------------------------------------------------------------------------------------------------------- |
| 0-6FFF    | Ram       |                                                                                                                             |
| 7000-7FFF | IO        | Unrealistically implemented, but read from any address to read from input buffer, write to any address to output to console |
| 8000-FFFF | Rom       | loaded from the command line argument                                                                                       |
