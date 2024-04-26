    .org $8000

INOUT = $7000

START:
    LDA INOUT       ;read from keyboard
    BEQ START
    TAX             ;copy to X if we got some input
    SEC
    SBC #$20        ;subtract $20, which is " " - space character
    BMI ENDLINE     ;jump if our character is below " "
    INX
    STX INOUT       ;write the incremented character out
    JMP START

ENDLINE:
    LDA #$0D        ;CR
    STA INOUT       
    LDA #$0A        ;LF
    STA INOUT
    JMP START


    .org $FFFC
    .word START     ;reset vector
    .word START     ;interrupt vector