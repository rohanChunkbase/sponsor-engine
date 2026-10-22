/**
 * Ask Raft frames. The open pose follows the cropped raft-wave drawing:
 * a large head, two small ears, and one arm raised on the right.
 */

const open = [
  "          ..    ..        ",
  "       .'          '.     ",
  "      /    o    o    \\    ",
  "     |      .--.      |   ",
  "      \\            /  |-. ",
  "       '.        .'   | ) ",
  "         '-.__.-'      |/ ",
  "           |    |     /   ",
  "           |    |    /    ",
  "          /      \\  /     ",
  "         '        ''      ",
];

const breath = [
  "          ..    ..        ",
  "       .'          '.     ",
  "      /    o    o    \\    ",
  "     |      .--.      |   ",
  "      \\            /   |  ",
  "       '.        .'   |-. ",
  "         '-.__.-'     | ) ",
  "           |    |      |/ ",
  "           |    |     /   ",
  "          /      \\   /    ",
  "         '        '''     ",
];

const blink = [
  "          ..    ..        ",
  "       .'          '.     ",
  "      /    -    -    \\    ",
  "     |      .--.      |   ",
  "      \\            /  |-. ",
  "       '.        .'   | ) ",
  "         '-.__.-'      |/ ",
  "           |    |     /   ",
  "           |    |    /    ",
  "          /      \\  /     ",
  "         '        ''      ",
];

const listen = [
  "          ..    ..        ",
  "       .'          '.     ",
  "      /    O    O    \\    ",
  "     |      .--.      |   ",
  "      \\            /  |-. ",
  "       '.        .'   | ) ",
  "         '-.__.-'      |/ ",
  "           |    |     /   ",
  "           |    |    /    ",
  "          /      \\  /     ",
  "         '        ''      ",
];

const pleased = [
  "          ..    ..        ",
  "       .'          '.     ",
  "      /    ^    ^    \\    ",
  "     |      \\__/      |   ",
  "      \\            /  |-. ",
  "       '.        .'   | ) ",
  "         '-.__.-'      |/ ",
  "           |    |     /   ",
  "           |    |    /    ",
  "          /      \\  /     ",
  "         '        ''      ",
];

export const asciiOtterFrames = { open, breath, blink, listen, pleased } as const;

export type AsciiOtterFrame = keyof typeof asciiOtterFrames;
