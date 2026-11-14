// One template, two builds. The U13 forensics package needs an exit trace the shipping build does
// not carry, and both builds are compiled from the same sources. Two marker pairs carry the switch:
// /*f*/ … /*endf*/ exists only in a --forensics build, /*o*/ … /*endo*/ only in a normal build.
// Blocks must not nest and each block must sit where removing it leaves valid JavaScript.
const FORE = /\/\*f\*\/[\s\S]*?\/\*endf\*\//g
const ORIG = /\/\*o\*\/[\s\S]*?\/\*endo\*\//g
const TOKEN = /\/\*(?:f|o|endf|endo)\*\//g
export const keepForensics = source => source.replace(ORIG, '').replace(TOKEN, '').replace(/[ \t]+$/gm, '')
export const stripForensics = source => source.replace(FORE, '').replace(TOKEN, '').replace(/[ \t]+$/gm, '')
