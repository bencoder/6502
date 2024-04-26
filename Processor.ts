import { Addressable } from "./Addressable";

const PC = 0;
const SP = 0;
const A = 1;
const X = 2;
const Y = 3;
const FLAGS = 4;
const FLAG_C = 0b00000001; // Carry
const FLAG_Z = 0b00000010; // Zero
const FLAG_I = 0b00000100; // Interupt disable
const FLAG_D = 0b00001000; // Decimal mode
const FLAG_B = 0b00010000; // Break
const FLAG_U = 0b00100000; // unused flag
const FLAG_V = 0b01000000; // Overflow
const FLAG_N = 0b10000000; // Negative
const oneByteInstructions = new Set([
  0x0a, // ASL A
  0x00, // BRK
  0x18, // CLC
  0xd8, // CLD
  0x58, // CLI
  0xb8, // CLV
  0xca, // DEX
  0x88, // DEY
  0xe8, // INX
  0xc8, // INY
  0x4a, // LSR A
  0xea, // NOP
  0x48, // PHA
  0x08, // PHP
  0x68, // PLA
  0x28, // PLP
  0x2a, // ROL A
  0x6a, // ROR A
  0x40, // RTI
  0x60, // RTS
  0x38, // SEC
  0xf8, // SED
  0x78, // SEI
  0xaa, // TAX
  0xa8, // TAY
  0xba, // TSX
  0x8a, // TXA
  0x9a, // TXS
  0x98, // TYA
]);

export class Processor {
  private registers: Uint8Array;
  private bigRegisters: Uint16Array;
  private cycles: number;

  constructor(private bus: Addressable) {
    this.registers = new Uint8Array(5);
    this.bigRegisters = new Uint16Array(1);
    this.cycles = 0;
    this.reset();
  }

  public setPC(pc: number) {
    this.bigRegisters[PC] = pc;
  }

  public getPC() {
    return this.bigRegisters[PC];
  }

  public reset() {
    // set the PC to the reset vector
    this.registers = new Uint8Array(5);
    this.bigRegisters = new Uint16Array(1);

    // set program counter to reset vector:
    this.bigRegisters[PC] = this.readMem(0xfffd) * 0x100 + this.readMem(0xfffc);
  }

  private fetch(): number {
    const data = this.readMem(this.bigRegisters[PC]);
    this.bigRegisters[PC]++;
    return data;
  }

  private readMem(location: number): number {
    const data = this.bus.read(location);
    this.cycles++;
    return data;
  }

  private writeMem(location: number, data: number) {
    this.bus.write(location, data);
    this.cycles++;
  }

  private setFlag(flag: number) {
    this.registers[FLAGS] = this.registers[FLAGS] | flag;
  }

  private unsetFlag(flag: number) {
    this.registers[FLAGS] = this.registers[FLAGS] & ~flag;
  }

  private setFlagsFor(value: number) {
    if (value & 0b10000000) {
      this.setFlag(FLAG_N);
    } else {
      this.unsetFlag(FLAG_N);
    }
    if (value === 0) {
      this.setFlag(FLAG_Z);
    } else {
      this.unsetFlag(FLAG_Z);
    }
  }

  private byte(value: number) {
    return value & 0xff;
  }

  private word(value: number) {
    return value & 0xffff;
  }

  private load(
    register: number,
    operand: number,
    getAddress?: (operand: number) => number
  ) {
    const value = getAddress ? this.readMem(getAddress(operand)) : operand;
    this.registers[register] = value;
    this.setFlagsFor(this.registers[register]);
  }

  private and(operand: number, getAddress?: (operand: number) => number) {
    const value = getAddress ? this.readMem(getAddress(operand)) : operand;
    this.registers[A] = this.registers[A] & value;
    this.setFlagsFor(this.registers[A]);
  }

  private store(
    register: number,
    operand: number,
    getAddress: (operand: number) => number
  ) {
    this.writeMem(getAddress(operand), this.registers[register]);
  }

  private convertFromBCD(value: number): number {
    const lowNibble = value & 0x0f;
    const highNibble = (value & 0xf0) >> 4;
    return highNibble * 10 + lowNibble;
  }

  private convertToBCD(value: number): number {
    value = value % 100; //discard any remainder
    const highNibble = Math.floor(value / 10);
    const lowNibble = value - highNibble * 10;
    return highNibble << (4 + lowNibble);
  }

  private internaladc(v1: number, v2: number) {
    const c = (this.registers[FLAGS] & FLAG_C) > 0 ? 1 : 0;
    const decimalMode = (this.registers[FLAGS] & FLAG_D) > 0;
    if (decimalMode) {
      v1 = this.convertFromBCD(v1);
      v2 = this.convertFromBCD(v2);
    }
    const sum = v1 + v2 + c;
    if (sum > (decimalMode ? 99 : 0xff)) {
      this.setFlag(FLAG_C);
    } else {
      this.unsetFlag(FLAG_C);
    }
    const result = decimalMode ? this.convertToBCD(sum) : this.byte(sum);
    // calculate overflow:
    if (((v1 ^ result) & (v2 ^ result) & 0x80) > 0) {
      this.setFlag(FLAG_V);
    } else {
      this.unsetFlag(FLAG_V);
    }
    this.setFlagsFor(result);
    return result;
  }

  private adc(operand: number, getAddress?: (operand: number) => number) {
    const v1 = this.registers[A];
    const v2 = getAddress ? this.readMem(getAddress(operand)) : operand;
    const sum = this.internaladc(v1, v2);
    this.registers[A] = sum;
  }

  private aslValue(value: number) {
    const carry = value & 0x80;
    const result = this.byte(value << 1);
    if (carry) {
      this.setFlag(FLAG_C);
    } else {
      this.unsetFlag(FLAG_C);
    }
    this.setFlagsFor(result);
    return result;
  }

  private asl(operand: number, getAddress: (operand: number) => number) {
    const address = getAddress(operand);
    const value = this.readMem(address);
    this.writeMem(address, this.aslValue(value));
  }

  private branchOnFlag(operand: number, flag: number, branchIf: boolean) {
    const flagStatus = this.registers[FLAGS] & flag ? true : false;
    if (flagStatus == branchIf) {
      this.cycles++;
      this.bigRegisters[PC] = this.relative(operand);
    }
  }

  private bit(operand: number, getAddress: (operand: number) => number) {
    const address = getAddress(operand);
    const data = this.readMem(address);
    const N = (data & 0b10000000) > 0;
    const V = (data & 0b01000000) > 0;
    const Z = (data & this.registers[A]) === 0;
    if (N) this.setFlag(FLAG_N);
    else this.unsetFlag(FLAG_N);
    if (V) this.setFlag(FLAG_V);
    else this.unsetFlag(FLAG_V);
    if (Z) this.setFlag(FLAG_Z);
    else this.unsetFlag(FLAG_Z);
  }

  private compare(
    register: number,
    operand: number,
    getAddress?: (operand: number) => number
  ) {
    const data = getAddress ? this.readMem(getAddress(operand)) : operand;
    const result = this.byte(this.registers[register] - data);
    this.setFlagsFor(result); // set N and Z flags
    if (this.registers[register] >= data) {
      this.setFlag(FLAG_C);
    } else {
      this.unsetFlag(FLAG_C);
    }
  }

  private exclusiveOr(
    operand: number,
    getAddress?: (operand: number) => number
  ) {
    const data = getAddress ? this.readMem(getAddress(operand)) : operand;
    const result = this.registers[A] ^ data;
    this.registers[A] = result;
    this.setFlagsFor(this.registers[A]);
  }

  private or(operand: number, getAddress?: (operand: number) => number) {
    const data = getAddress ? this.readMem(getAddress(operand)) : operand;
    const result = this.registers[A] | data;
    this.registers[A] = result;
    this.setFlagsFor(this.registers[A]);
  }

  private break() {
    this.pushPC(1); //Add an additional 1 to the PC because BRK is secretly a 2 byte operation
    this.push(this.registers[FLAGS] | FLAG_B | FLAG_U);
    this.setFlag(FLAG_I);
    //get the location from the interrupt vector and jump to it
    const lowByte = this.readMem(0xfffe);
    const highByte = this.readMem(0xffff);
    this.bigRegisters[PC] = highByte * 0x100 + lowByte;
  }

  private incdec(
    operand: number,
    incdec: number,
    getAddress: (operand: number) => number
  ) {
    const address = getAddress(operand);
    const data = this.readMem(address);
    const result = this.byte(data + incdec);
    this.writeMem(address, result);
    this.setFlagsFor(result);
  }

  private incdecRegister(register: number, incdec: number) {
    this.registers[register] = this.byte(this.registers[register] + incdec);
    this.setFlagsFor(this.registers[register]);
  }

  private jump(operand: number, getAddress: (operand: number) => number) {
    const address = getAddress(operand);
    this.bigRegisters[PC] = address;
  }

  private jumpSubroutine(
    operand: number,
    getAddress: (operand: number) => number
  ) {
    const address = getAddress(operand);
    this.pushPC(-1);
    this.bigRegisters[PC] = address;
  }

  // lsr's a value, setting flags and returning result
  private lsrValue(value: number) {
    const carry = value & 1;
    const result = value >> 1;
    this.setFlagsFor(result);
    if (carry) {
      this.setFlag(FLAG_C);
    } else {
      this.unsetFlag(FLAG_C);
    }
    return result;
  }

  private lsr(operand: number, getAddress: (operand: number) => number) {
    const address = getAddress(operand);
    const value = this.readMem(address);
    this.writeMem(address, this.lsrValue(value));
  }

  private plp() {
    const oldFlags = this.registers[FLAGS];
    let data = this.pull();
    //Set the B and U flags to whatever they were rather than what was on the stack
    if (oldFlags & FLAG_B) {
      data = data | FLAG_B;
    } else {
      data = data & ~FLAG_B;
    }
    if (oldFlags & FLAG_U) {
      data = data | FLAG_U;
    } else {
      data = data & ~FLAG_U;
    }
    this.registers[FLAGS] = data;
  }

  // ROL's a value, setting flags and returning the result
  private rolValue(value: number) {
    const oldCarry = this.registers[FLAGS] & FLAG_C ? 1 : 0;
    const newCarry = value & 0x80 ? 1 : 0;
    let result = this.byte(value << 1);
    if (oldCarry) {
      result = result | 1;
    }
    if (newCarry) {
      this.setFlag(FLAG_C);
    } else {
      this.unsetFlag(FLAG_C);
    }
    this.setFlagsFor(result);
    return result;
  }

  private rol(operand: number, getAddress: (operand: number) => number) {
    const address = getAddress(operand);
    const value = this.readMem(address);
    this.writeMem(address, this.rolValue(value));
  }

  // ROR's a value, setting flags and returning the result
  private rorValue(value: number) {
    const oldCarry = this.registers[FLAGS] & FLAG_C ? 1 : 0;
    const newCarry = value & 1;
    let result = value >> 1;
    if (oldCarry) {
      result = result | 0x80;
    }
    if (newCarry) {
      this.setFlag(FLAG_C);
    } else {
      this.unsetFlag(FLAG_C);
    }
    this.setFlagsFor(result);
    return result;
  }

  private ror(operand: number, getAddress: (operand: number) => number) {
    const address = getAddress(operand);
    const value = this.readMem(address);
    this.writeMem(address, this.rorValue(value));
  }

  private returnInterrupt() {
    this.plp();
    this.returnSubroutine(0);
  }

  private returnSubroutine(offset = 1) {
    const lowByte = this.pull();
    const highByte = this.pull();
    this.bigRegisters[PC] = highByte * 0x100 + lowByte + offset;
  }

  private sbc(operand: number, getAddress?: (operand: number) => number) {
    const v1 = this.registers[A];
    const v2 = getAddress ? this.readMem(getAddress(operand)) : operand;
    //sbc should be the same operation as adc but with the bits of the memory byte flipped
    //>>> coerces to an unsigned int so that the bitwise invert ~ works as expected, otherwise in JS ~0xff == -255
    const sum = this.internaladc(v1, (~v2 >>> 0) & 0xff);
    this.registers[A] = sum;
  }

  // transfer data between registers
  private transfer(register1: number, register2: number, setFlags = true) {
    this.registers[register2] = this.registers[register1];
    if (setFlags) this.setFlagsFor(this.registers[register2]);
  }

  // push byte to stack
  private push(byte: number) {
    this.writeMem(0x0100 + this.registers[SP], byte);
    this.registers[SP] = this.byte(this.registers[SP] - 1);
  }

  private pushPC(offset: number = 0) {
    const currentPC = this.bigRegisters[PC] + offset;
    this.push(this.byte(currentPC >> 8)); // push high byte
    this.push(this.byte(currentPC)); //push low byte
  }

  private pullA() {
    this.registers[A] = this.pull();
    this.setFlagsFor(this.registers[A]);
  }

  private pull(): number {
    this.registers[SP] = this.byte(this.registers[SP] + 1);
    const data = this.readMem(0x0100 + this.registers[SP]);
    return data;
  }

  private zeroPage = (operand: number) => operand;
  private zeroPageIndexed = (indexRegister: number) => {
    return (operand: number) =>
      this.byte(operand + this.registers[indexRegister]);
  };
  private absolute = (operand: number) => {
    const highByte = this.fetch();
    return highByte * 0x100 + operand;
  };
  private absoluteIndirect = (operand: number) => {
    const highByte = this.fetch();
    const indexAddress = highByte * 0x100 + operand;
    const resultLowByte = this.readMem(indexAddress);
    const resultHighByte = this.readMem(indexAddress + 1);
    return resultHighByte * 0x100 + resultLowByte;
  };
  private absoluteIndexed = (indexRegister: number) => {
    return (operand: number) => {
      const highByte = this.fetch();
      const lowByte = operand + this.registers[indexRegister];
      if (lowByte > 0xff) {
        this.cycles++;
      } // if we go across a page boundary, add a cycle count
      return this.word(highByte * 0x100 + lowByte);
    };
  };
  private zeroPagePreIndexedIndirectX = (operand: number) => {
    const lowByte = this.readMem(this.byte(operand + this.registers[X]));
    const highByte = this.readMem(this.byte(operand + this.registers[X] + 1));
    return highByte * 0x100 + lowByte;
  };
  private zeroPagePostIndexedIndirectY = (operand: number) => {
    const lowByte = this.readMem(operand) + this.registers[Y];
    const highByte = this.readMem(this.byte(operand + 1));
    if (lowByte > 0xff) {
      this.cycles++;
    } // if we go across a page boundary, add a cycle count
    return this.word(highByte * 0x100 + lowByte);
  };
  private relative = (operand: number) => {
    const signedOperand = (operand << 24) >> 24; // shift up and then back down to convert to signed 32 bit number
    const highByte = this.bigRegisters[PC] & 0xff00;
    const lowByte = (this.bigRegisters[PC] & 0x00ff) + signedOperand;
    if (lowByte < 0 || lowByte > 0xff) {
      this.cycles++;
    } // if we go across a page boundary, add a cycle count
    return this.word(highByte + lowByte);
  };

  // processes the next instruction, returns the number of clock cycles it took
  public tick(debug = false): number {
    const initialPC = this.bigRegisters[PC];
    const logRegisters = () => {
      console.log({
        initialPC: initialPC.toString(16).padStart(4, "0"),
        PC: this.bigRegisters[PC].toString(16).padStart(4, "0"),
        SP: this.registers[SP].toString(16).padStart(2, "0"),
        A: this.registers[A].toString(16).padStart(2, "0"),
        X: this.registers[X].toString(16).padStart(2, "0"),
        Y: this.registers[Y].toString(16).padStart(2, "0"),
        FLAGS: this.registers[FLAGS].toString(2).padStart(8, "0"),
        opcode: opcode.toString(16).padStart(2, "0"),
        operand: operand.toString(16).padStart(2, "0"),
      });
    };
    this.cycles = 0;
    const opcode = this.fetch();
    // although some instructions are 1 byte it always gets the next byte from
    // memory,
    const operand = this.fetch();

    // have to set the Program Counter back for 1 byte instructions
    if (oneByteInstructions.has(opcode)) {
      this.bigRegisters[PC]--;
    }

    switch (opcode) {
      case 0x69: // ADC #
        this.adc(operand);
        break;
      case 0x65: // ADC ZP
        this.adc(operand, this.zeroPage);
        break;
      case 0x75: // ADC ZP,X
        this.adc(operand, this.zeroPageIndexed(X));
        break;
      case 0x6d: // ADC ABS
        this.adc(operand, this.absolute);
        break;
      case 0x7d: // ADC ABS,X
        this.adc(operand, this.absoluteIndexed(X));
        break;
      case 0x79: // ADC ABS,Y
        this.adc(operand, this.absoluteIndexed(Y));
        break;
      case 0x61: // ADC (ZP, X)
        this.adc(operand, this.zeroPagePreIndexedIndirectX);
        break;
      case 0x71: // ADC (ZP), Y
        this.adc(operand, this.zeroPagePostIndexedIndirectY);
        break;

      case 0x29: // AND #
        this.and(operand);
        break;
      case 0x25: // AND ZP
        this.and(operand, this.zeroPage);
        break;
      case 0x35: // AND ZP,X
        this.and(operand, this.zeroPageIndexed(X));
        break;
      case 0x2d: // AND ABS
        this.and(operand, this.absolute);
        break;
      case 0x3d: // AND ABS,X
        this.and(operand, this.absoluteIndexed(X));
        break;
      case 0x39: // AND ABS,Y
        this.and(operand, this.absoluteIndexed(Y));
        break;
      case 0x21: // AND (ZP,X)
        this.and(operand, this.zeroPagePreIndexedIndirectX);
        break;
      case 0x31: // AND (ZP),Y
        this.and(operand, this.zeroPagePostIndexedIndirectY);
        break;

      case 0x0a: // ASL A
        this.registers[A] = this.aslValue(this.registers[A]);
        break;
      case 0x06: // ASL ZP
        this.asl(operand, this.zeroPage);
        break;
      case 0x16: // ASL ZP,X
        this.asl(operand, this.zeroPageIndexed(X));
        break;
      case 0x0e: // ASL ABS
        this.asl(operand, this.absolute);
        break;
      case 0x1e: // ASL ABS,X
        this.asl(operand, this.absoluteIndexed(X));
        break;

      case 0x90: // BCC
        this.branchOnFlag(operand, FLAG_C, false);
        break;
      case 0xb0: // BCS
        this.branchOnFlag(operand, FLAG_C, true);
        break;
      case 0xf0: // BEQ (Branch if equal, or zero)
        this.branchOnFlag(operand, FLAG_Z, true);
        break;
      case 0x30: // BMI (Branch if minus)
        this.branchOnFlag(operand, FLAG_N, true);
        break;
      case 0xd0: // BNE (branch if not equal)
        this.branchOnFlag(operand, FLAG_Z, false);
        break;
      case 0x10: // BPL (branch if plus)
        this.branchOnFlag(operand, FLAG_N, false);
        break;
      case 0x50: // BVC
        this.branchOnFlag(operand, FLAG_V, false);
        break;
      case 0x70: // BVS
        this.branchOnFlag(operand, FLAG_V, true);
        break;

      case 0x24: // BIT ZP
        this.bit(operand, this.zeroPage);
        break;
      case 0x2c: // BIT ABS
        this.bit(operand, this.absolute);
        break;

      case 0x00: // BRK
        this.break();
        break;

      case 0x18: // CLC
        this.unsetFlag(FLAG_C);
        break;

      case 0xd8: // CLD
        this.unsetFlag(FLAG_D);
        break;

      case 0x58: // CLI
        this.unsetFlag(FLAG_I);
        break;

      case 0xb8: // CLV
        this.unsetFlag(FLAG_V);
        break;

      case 0xc9: // CMP #
        this.compare(A, operand);
        break;
      case 0xc5: // CMP ZP
        this.compare(A, operand, this.zeroPage);
        break;
      case 0xd5: // CMP ZP,X
        this.compare(A, operand, this.zeroPageIndexed(X));
        break;
      case 0xcd: // CMP ABS
        this.compare(A, operand, this.absolute);
        break;
      case 0xdd: // CMP ABS,X
        this.compare(A, operand, this.absoluteIndexed(X));
        break;
      case 0xd9: // CMP ABS,Y
        this.compare(A, operand, this.absoluteIndexed(Y));
        break;
      case 0xc1: // CMP (ZP,X)
        this.compare(A, operand, this.zeroPagePreIndexedIndirectX);
        break;
      case 0xd1: // CMP (ZP),Y
        this.compare(A, operand, this.zeroPagePostIndexedIndirectY);
        break;

      case 0xe0: // CPX #
        this.compare(X, operand);
        break;
      case 0xe4: // CPX ZP
        this.compare(X, operand, this.zeroPage);
        break;
      case 0xec: // CPX ABS
        this.compare(X, operand, this.absolute);
        break;

      case 0xc0: // CPY #
        this.compare(Y, operand);
        break;
      case 0xc4: // CPY ZP
        this.compare(Y, operand, this.zeroPage);
        break;
      case 0xcc: // CPY ABS
        this.compare(Y, operand, this.absolute);
        break;

      case 0xc6: // DEC ZP
        this.incdec(operand, -1, this.zeroPage);
        break;
      case 0xd6: // DEC ZP,X
        this.incdec(operand, -1, this.zeroPageIndexed(X));
        break;
      case 0xce: // DEC ABS
        this.incdec(operand, -1, this.absolute);
        break;
      case 0xde: // DEC ABS,X
        this.incdec(operand, -1, this.absoluteIndexed(X));
        break;

      case 0xca: // DEX
        this.incdecRegister(X, -1);
        break;
      case 0x88: // DEY
        this.incdecRegister(Y, -1);
        break;

      case 0x49: // EOR #
        this.exclusiveOr(operand);
        break;
      case 0x45: // EOR ZP
        this.exclusiveOr(operand, this.zeroPage);
        break;
      case 0x55: // EOR ZP,X
        this.exclusiveOr(operand, this.zeroPageIndexed(X));
        break;
      case 0x4d: // EOR ABS
        this.exclusiveOr(operand, this.absolute);
        break;
      case 0x5d: // EOR ABS,X
        this.exclusiveOr(operand, this.absoluteIndexed(X));
        break;
      case 0x59: // EOR ABS,Y
        this.exclusiveOr(operand, this.absoluteIndexed(Y));
        break;
      case 0x41: // EOR (ZP,X)
        this.exclusiveOr(operand, this.zeroPagePreIndexedIndirectX);
        break;
      case 0x51: // EOR (ZP),Y
        this.exclusiveOr(operand, this.zeroPagePostIndexedIndirectY);
        break;

      case 0xe6: // INC ZP
        this.incdec(operand, +1, this.zeroPage);
        break;
      case 0xf6: // INC ZP,X
        this.incdec(operand, +1, this.zeroPageIndexed(X));
        break;
      case 0xee: // INC ABS
        this.incdec(operand, +1, this.absolute);
        break;
      case 0xfe: // INC ABS,X
        this.incdec(operand, +1, this.absoluteIndexed(X));
        break;

      case 0xe8: // INX
        this.incdecRegister(X, +1);
        break;
      case 0xc8: // INY
        this.incdecRegister(Y, +1);
        break;

      case 0x4c: // JMP ABS
        this.jump(operand, this.absolute);
        break;
      case 0x6c: // JMP (ABS)
        this.jump(operand, this.absoluteIndirect);
        break;

      case 0x20: // JSR ABS
        this.jumpSubroutine(operand, this.absolute);
        break;

      case 0xa9: // LDA #
        this.load(A, operand);
        break;
      case 0xa5: // LDA ZP
        this.load(A, operand, this.zeroPage);
        break;
      case 0xb5: // LDA ZP,X
        this.load(A, operand, this.zeroPageIndexed(X));
        break;
      case 0xad: // LDA ABS
        this.load(A, operand, this.absolute);
        break;
      case 0xbd: // LDA ABS,X
        this.load(A, operand, this.absoluteIndexed(X));
        break;
      case 0xb9: // LDA ABS,Y
        this.load(A, operand, this.absoluteIndexed(Y));
        break;
      case 0xa1: // LDA (ZP,X)
        this.load(A, operand, this.zeroPagePreIndexedIndirectX);
        break;
      case 0xb1: // LDA (ZP), Y
        this.load(A, operand, this.zeroPagePostIndexedIndirectY);
        break;

      case 0xa2: // LDX #
        this.load(X, operand);
        break;
      case 0xa6: // LDX ZP
        this.load(X, operand, this.zeroPage);
        break;
      case 0xb6: // LDX ZP,Y
        this.load(X, operand, this.zeroPageIndexed(Y));
        break;
      case 0xae: // LDX ABS
        this.load(X, operand, this.absolute);
        break;
      case 0xbe: // LDX ABS,Y
        this.load(X, operand, this.absoluteIndexed(Y));
        break;

      case 0xa0: // LDY #
        this.load(Y, operand);
        break;
      case 0xa4: // LDY ZP
        this.load(Y, operand, this.zeroPage);
        break;
      case 0xb4: // LDY ZP,X
        this.load(Y, operand, this.zeroPageIndexed(X));
        break;
      case 0xac: // LDY ABS
        this.load(Y, operand, this.absolute);
        break;
      case 0xbc: // LDY ABS,X
        this.load(Y, operand, this.absoluteIndexed(X));
        break;

      case 0x4a: // LSR A
        this.registers[A] = this.lsrValue(this.registers[A]);
        break;
      case 0x46: // LSR ZP
        this.lsr(operand, this.zeroPage);
        break;
      case 0x56: // LSR ZP,X
        this.lsr(operand, this.zeroPageIndexed(X));
        break;
      case 0x4e: // LSR ABS
        this.lsr(operand, this.absolute);
        break;
      case 0x5e: // LSR ABS,X
        this.lsr(operand, this.absoluteIndexed(X));
        break;

      case 0xea: // NOP
        break;

      case 0x09: // ORA #
        this.or(operand);
        break;
      case 0x05: // ORA ZP
        this.or(operand, this.zeroPage);
        break;
      case 0x15: // ORA ZP,X
        this.or(operand, this.zeroPageIndexed(X));
        break;
      case 0x0d: // ORA ABS
        this.or(operand, this.absolute);
        break;
      case 0x1d: // ORA ABS,X
        this.or(operand, this.absoluteIndexed(X));
        break;
      case 0x19: // ORA ABS,Y
        this.or(operand, this.absoluteIndexed(Y));
        break;
      case 0x01: // ORA (ZP,X)
        this.or(operand, this.zeroPagePreIndexedIndirectX);
        break;
      case 0x11: // ORA (ZP),Y
        this.or(operand, this.zeroPagePostIndexedIndirectY);
        break;

      case 0x48: // PHA
        this.push(this.registers[A]);
        break;
      case 0x08: // PHP
        this.push(this.registers[FLAGS] | FLAG_B | FLAG_U);
        break;

      case 0x68: // PLA
        this.pullA();
        break;

      case 0x28: // PLP
        this.plp();
        break;

      case 0x2a: // ROL A
        this.registers[A] = this.rolValue(this.registers[A]);
        break;
      case 0x26: // ROL ZP
        this.rol(operand, this.zeroPage);
        break;
      case 0x36: // ROL ZP,X
        this.rol(operand, this.zeroPageIndexed(X));
        break;
      case 0x2e: // ROL ABS
        this.rol(operand, this.absolute);
        break;
      case 0x3e: // ROL ABS,X
        this.rol(operand, this.absoluteIndexed(X));
        break;

      case 0x6a: // ROR A
        this.registers[A] = this.rorValue(this.registers[A]);
        break;
      case 0x66: // ROR ZP
        this.ror(operand, this.zeroPage);
        break;
      case 0x76: // ROR ZP,X
        this.ror(operand, this.zeroPageIndexed(X));
        break;
      case 0x6e: // ROR ABS
        this.ror(operand, this.absolute);
        break;
      case 0x7e: // ROR ABS,X
        this.ror(operand, this.absoluteIndexed(X));
        break;

      case 0x40: // RTI
        this.returnInterrupt();
        break;

      case 0x60: // RTS
        this.returnSubroutine();
        break;

      case 0xe9: // SBC #
        this.sbc(operand);
        break;
      case 0xe5: //SBC ZP
        this.sbc(operand, this.zeroPage);
        break;
      case 0xf5: //SBC ZP,X
        this.sbc(operand, this.zeroPageIndexed(X));
        break;
      case 0xed: //SBC ABS
        this.sbc(operand, this.absolute);
        break;
      case 0xfd: //SBC ABS,X
        this.sbc(operand, this.absoluteIndexed(X));
        break;
      case 0xf9: //SBC ABS,Y
        this.sbc(operand, this.absoluteIndexed(Y));
        break;
      case 0xe1: //SBC (ZP,X)
        this.sbc(operand, this.zeroPagePreIndexedIndirectX);
        break;
      case 0xf1: //SBC (ZP),Y
        this.sbc(operand, this.zeroPagePostIndexedIndirectY);
        break;

      case 0x38: // SEC
        this.setFlag(FLAG_C);
        break;
      case 0xf8: // SED
        this.setFlag(FLAG_D);
        break;
      case 0x78: // SEI
        this.setFlag(FLAG_I);
        break;

      case 0x85: // STA ZP
        this.store(A, operand, this.zeroPage);
        break;
      case 0x95: // STA ZP,X
        this.store(A, operand, this.zeroPageIndexed(X));
        break;
      case 0x8d: // STA ABS
        this.store(A, operand, this.absolute);
        break;
      case 0x9d: // STA ABS,X
        this.store(A, operand, this.absoluteIndexed(X));
        break;
      case 0x99: // STA ABS,Y
        this.store(A, operand, this.absoluteIndexed(Y));
        break;
      case 0x81: // STA (ZP,X)
        this.store(A, operand, this.zeroPagePreIndexedIndirectX);
        break;
      case 0x91: // STA (ZP),Y
        this.store(A, operand, this.zeroPagePostIndexedIndirectY);
        break;

      case 0x86: // STX ZP
        this.store(X, operand, this.zeroPage);
        break;
      case 0x96: // STX ZP,Y
        this.store(X, operand, this.zeroPageIndexed(Y));
        break;
      case 0x8e: // STX ABS
        this.store(X, operand, this.absolute);
        break;

      case 0x84: // STY ZP
        this.store(Y, operand, this.zeroPage);
        break;
      case 0x94: // STY ZP,X
        this.store(Y, operand, this.zeroPageIndexed(X));
        break;
      case 0x8c: // STY ABS
        this.store(Y, operand, this.absolute);
        break;

      // transfers:
      case 0xaa: // TAX
        this.transfer(A, X);
        break;
      case 0xa8: // TAY
        this.transfer(A, Y);
        break;
      case 0xba: // TSX
        this.transfer(SP, X);
        break;
      case 0x8a: // TXA
        this.transfer(X, A);
        break;
      case 0x9a: // TXS
        this.transfer(X, SP, false);
        break;
      case 0x98: // TYA
        this.transfer(Y, A);
        break;

      default:
        logRegisters();
        throw new Error("invalid opcode: " + opcode.toString(16));
    }

    if (debug) {
      logRegisters();
    }

    return this.cycles;
  }
}
