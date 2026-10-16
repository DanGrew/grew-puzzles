const { test, expect } = require('@playwright/test');

// How to play, a page a kind (the product's TASK-212): opened only by the book icon beside each kind
// in the side bar, and on each play page; Basics | Advanced | Variants pills at the top, Basics
// picked as it opens; Variants holds the kind's types, a section each in the owner's words (the
// product's docs/CONTENT.md, How to play) beside its picture (tooling's tools/grew-puzzles-how-to-play).
const WORDSEARCH_TYPES = [
  ['vanilla', 'Vanilla', 'Vanilla wordsearches', 'A nice calming wordsearch. No tricks, no challenges; just a normal puzzle: find the words in the list. Words can run in any direction, including diagonally. Of course, they can overlap, but rest assured that words within words (like \'grape\' within \'grapefruit\') appear as two separate words in the grid.', 'A Vanilla wordsearch, with the word BULLOCK found in the grid.'],
  ['missing-words', 'Missing words', 'Missing words wordsearches', 'This is the first type of challenge! The word list includes one or more words that aren\'t in the puzzle… You might have been looking so hard for a word that isn\'t actually in the puzzle! What fun!', 'A Missing words wordsearch with every word found; the leftover words in the list aren\'t in the grid.'],
  ['repeating-words', 'Repeating words', 'Repeating words wordsearches', 'The next challenge doesn\'t involve any trickery, but it does test your focus! The puzzle contains only one word… but lots of it. What starts off as a novelty might leave you seeing the word \'sheep\' in your sleep!', 'A Repeating words wordsearch where every word is SHEEP, with one copy found.'],
  ['wildcard', 'Wildcard', 'Wildcard wordsearches', 'Back to tricky stuff: wildcards are letters in the puzzle hidden behind a \'?\'. Each one stands for a single letter, which could be any letter, and each wildcard can be a different one. Basically, we\'ve just hidden letters to make it harder for you!', 'A Wildcard wordsearch with \'?\' letters in the grid, and BROOM found across one of them.'],
  ['saga', 'Saga', 'Saga wordsearches', 'No more rules, just lots of words! These puzzles have a huge list of words split across several grids. And you guessed it, you have no idea which words are in which grid!', 'A Saga wordsearch: one long word list split across several grids.'],
  ['mirrage', 'Mirra?e', 'Mirra?e wordsearches', 'The ultimate challenge: every trick at once! Two puzzle grids, a word list with words that aren\'t really there, \'?\' wildcards hiding letters, and one word hidden five times across both grids. Like any good mirage, not everything you see is real… Good luck!', 'A Mirra?e wordsearch with \'?\' letters, showing a second copy of TELESCOPE found.'],
];
// The mazes, after every wordsearch, each address ending -maze so a Vanilla maze is never a
// Vanilla wordsearch.
const MAZE_TYPES = [
  ['vanilla-maze', 'Vanilla', 'Vanilla mazes', 'A nice calming maze. Find your way from the start to the end, and pick up the guides as you go. They\'re all on the right path, so if you\'ve found one, you\'re heading the right way!', 'A Vanilla maze with a trail started from the start, passing two guides.'],
  ['collectibles-maze', 'Collectibles', 'Collectibles mazes', 'There\'s treasure off the beaten track! Collectibles are hidden down the side paths, never on the way to the end. Find every one, then make your way out.', 'A Collectibles maze with a trail started from the start, reaching its first collectible.'],
  ['code-breaker-maze', 'Code Breaker', 'Code Breaker mazes', 'Six exits, but only one is right! Find A, B and C, hidden down side paths. Follow the one true route from the start, and the order you pass their turnings is the code. That\'s your exit! Want to finish the whole maze? Find all six exits: the right one gets a ✓ and the rest get a ✗.', 'A Code Breaker maze with a trail started from the start, reaching the letter B.'],
  ['keys-maze', 'Keys', 'Keys mazes', 'Some of the maze is locked! Bump into a locked zone and it\'ll show you the number of the key it needs. That key is somewhere outside the zone. Find it and the zone opens up. Pick up every key to finish!', 'A Keys maze with a trail started from the start, reaching Key 1 and opening its zone.'],
  ['keylecticodes-maze', 'Keylecticodes', 'Keylecticodes mazes', 'Everything at once! Guides, collectibles, keys and zones, A, B and C and six exits, all in one maze. Good luck!', 'A Keylecticodes maze with a trail started from the start, passing a guide and reaching Key 1.'],
];
// Minesweeper, after the mazes: one section for the kind, its picture a board part solved.
const MINESWEEPER_TYPES = [
  ['minesweeper', 'Minesweeper', 'Minesweeper', 'No luck needed, just a little thinking! Some squares show a number. Each number counts the mines in the eight squares around it, and a square with a number is never a mine. Tap a square once to mark it safe with a dot, again to mark a mine, and again to clear it. In a hurry? Tap a number. If all its mines are marked, its other squares get dots. If its empty squares must all be mines, they\'re marked for you. Every board can be solved by logic alone, so you\'ll never have to guess. Mark every mine to finish!', 'A Minesweeper board, part solved: the squares around a 0 dotted, and a number\'s mines marked.'],
];
// Criss-cross, after Minesweeper: one section, Vanilla, its one type (the product's TASK-221), its
// picture a shape with its starting word in place and the only word of its length placed next.
const CRISS_TYPES = [
  ['criss-cross', 'Vanilla', 'Vanilla criss-crosses', 'A list of words and an empty shape: can you fit them all in? One word is already in place to get you started. Words cross where they share a letter, so every word you place gives you letters for the next. Tap a slot, then tap a word to put it in. If it doesn\'t fit the letters already there, it won\'t go in. Changed your mind? Tap a word you\'ve placed to take it back out. Every puzzle can be solved by logic alone, so you\'ll never have to guess. Fill every slot to finish!', 'A Vanilla criss-cross with its starting word in place, and ANNIVERSARY placed beside it.'],
];
const KINDS = [
  ['wordsearch', 'Wordsearches', WORDSEARCH_TYPES],
  ['maze', 'Mazes', MAZE_TYPES],
  ['minesweeper', 'Minesweeper', MINESWEEPER_TYPES],
  ['crisscross', 'Criss-cross', CRISS_TYPES],
  ['mosaic', 'Mosaic', []],
];
// Wordsearches' Basics and Advanced (the product's TASK-218), as the owner marked them on the
// worksheet (its docs/RULES.md) and worded them (its docs/CONTENT.md, How to play): every basic said
// with its example, a sentence beside its picture; every advanced move in, its name, when it
// happens, then the puzzle, how it's spotted and the word found, each captioned. The pictures are
// tooling's tools/grew-puzzles-rules, drawn from the worksheet's made-up grids.
const WORDSEARCH_BASICS = [
  ['every', 'Find every word in the list. The puzzle\'s done when they\'re all found: here, CAT, DOG and HEN.', 'A small grid with CAT, DOG and HEN found, and all three crossed off the word list.'],
  ['eight', 'Words run in eight directions: across, down, diagonally, and backwards in any of them. OWL here reads up and to the left, on a diagonal and backwards.', 'A small grid with OWL found reading diagonally up and to the left.'],
  ['share', 'Words can cross, sharing a letter. COW and CAT share their C, and a shared letter gets a circle.', 'A small grid with COW running across and CAT running down from the same circled C.'],
  ['inside', 'A word inside another word doesn\'t count. The PIG inside PIGLET isn\'t the one you\'re after: PIG is hidden on its own.', 'A small grid with PIGLET found across the top, and PIG found on its own, running upwards.'],
  ['mark', 'To mark a word, tap its first letter, then its last. Tap the F, then the X. Either end works.', 'A small grid with FOX found on a diagonal, its F circled where the tap began.'],
  ['struck', 'A found word is crossed off the list. FOX is found, so it\'s crossed off.', 'A word list of FOX, HEN and OWL, with FOX crossed off.'],
];
const WORDSEARCH_MOVES = [
  ['rare', 'Hunt the rarest letter first', 'When a word has a letter the grid hardly uses, like Z, Q, X or J.', [
    ['The puzzle', 'Find WIZARD.', 'A 6 by 6 grid of letters, WIZARD hidden somewhere in it.'],
    ['Spot it', 'Z is WIZARD\'s rarest letter, and this grid has only one Z.', 'The same grid with its only Z circled.'],
    ['Found', 'WIZARD runs through the Z, corner to corner.', 'The same grid with WIZARD found, corner to corner.']]],
  ['double', 'Double letters', 'When a word has the same letter twice in a row, like the TT in KITTEN.', [
    ['The puzzle', 'Find KITTEN. There are Ts everywhere.', 'A 6 by 6 grid full of Ts, KITTEN hidden somewhere in it.'],
    ['Spot it', 'Only one pair of Ts sits side by side.', 'The same grid with its one side-by-side pair of Ts circled.'],
    ['Found', 'KITTEN runs through the pair.', 'The same grid with KITTEN found through the pair of Ts.']]],
  ['ends', 'A word\'s first and last letter together', 'When the grid is full of a word\'s letters, look for its first and last, the word\'s length apart.', [
    ['The puzzle', 'Find ROCKET. The grid is full of Rs and Ts.', 'A 6 by 6 grid full of Rs and Ts, ROCKET hidden somewhere in it.'],
    ['Spot it', 'ROCKET\'s R and T sit 6 letters apart in a line. Only one R and T do.', 'The same grid with one R and one T circled, six letters apart in a line.'],
    ['Found', 'ROCKET runs between them, upwards.', 'The same grid with ROCKET found, running upwards.']]],
  ['direction', 'One direction at a time', 'When a word just won\'t turn up. Read the grid one way only, right to left, say.', [
    ['The puzzle', 'Find TIGER.', 'A 6 by 6 grid of letters, TIGER hidden somewhere in it.'],
    ['Spot it', 'Read every row right to left, and nothing else. Row 4 gives TIGER.', 'The same grid with the fourth row circled, letter by letter.'],
    ['Found', 'TIGER, running backwards.', 'The same grid with TIGER found, running right to left.']]],
  ['long', 'A long word before a short one', 'When the list has long words and short ones. A long word has far fewer places it can fit.', [
    ['The puzzle', 'Find RAINBOW and OWL.', 'A 7 by 7 grid above a word list of RAINBOW and OWL.'],
    ['Spot it', 'RAINBOW fills a whole line of 7, edge to edge. Of the Rs on the edge, only one has a W on the far edge.', 'The same grid with an R and a W circled in opposite corners, and the other edge Rs circled in red.'],
    ['Found', 'RAINBOW is found first. Now look for OWL.', 'The same grid with RAINBOW found corner to corner, and crossed off the list.']]],
];
// Minesweeper's (the product's TASK-220), the same way: its pictures the worksheet's made-up boards,
// played on the minesweeper page itself, and a move's last step what it settles.
const MINESWEEPER_BASICS = [
  ['goal', 'Find every mine. Mark them all and the board is solved: here, all four. Squares marked no mine don\'t count toward it.', 'A 5 by 5 board with its four mines marked, and Solved — every mine found under it.'],
  ['count', 'A number counts the mines in the eight squares around it. This 3 has three mines in the eight squares around it, inside the box.', 'A board with a 3 in the middle, a dashed box round the eight squares around it, and three mines marked inside the box.'],
  ['never', 'A numbered square is never a mine. The 2\'s two mines are in the blank squares around it. The 1 beside it is a number, so it\'s never one of them, and it can\'t be marked.', 'A board with a 2 and a 1 side by side, and a dashed box round the 2\'s squares.'],
  ['edges', 'Edges and corners have fewer squares around them. A number in a corner has only three squares around it, and one on an edge has five. Each 1 here has its one mine inside its box.', 'A board with a 1 in its top-left corner and a 1 on its right edge, each with a dashed box round its squares.'],
  ['tap', 'Tap a square once to mark it no mine, again to mark it a mine, and again to clear it. A square marked no mine turns grey. The Mines card beside the board says the same.', 'One square tapped three times: blank, then grey for no mine, then marked as a mine, then blank again.'],
  ['fill', 'Tap a number to fill in around it. This 2 has both its mines marked, so its other blank squares fill in as no mine. If a number\'s blank squares must all be mines, they fill in as mines. Otherwise nothing happens. It goes by your own marks, so a wrong mark carries in.', 'A board with a 2 ringed and both its mines marked, then the same board once the 2 is tapped, its other squares grey.'],
  ['check', 'Check shows your mistakes. It rings in red every mark that\'s wrong: here, a mine where there isn\'t one, and no mine on a mine. The line under it says how many, and the rings go at your next tap. Blank squares are never checked.', 'A board with two marks ringed in red, Check and Undo under it, and 2 mistakes under them.'],
  ['undo', 'Undo takes back a tap. Here it takes back the 2\'s fill, all in one go. Press it again to go further back. There\'s no Redo.', 'A board just after its 2 was tapped, then the same board after Undo, the 2\'s fill taken back.'],
  ['no-guess', 'You never need to guess. Every board has exactly one answer, and its numbers alone lead to it. This one is solved from its six numbers.', 'A 5 by 4 board with six numbers and nothing marked.'],
];
const MINESWEEPER_MOVES = [
  ['met', 'A number already met', 'When a number already has all its mines marked.', [
    ['The board', 'A 1 with a mine already marked next to it.', 'A 5 by 5 board, a 1 in the middle with a mine marked beside it.'],
    ['Spot it', 'The 1 already has its one mine. Its count is met.', 'The same board with the 1 ringed.'],
    ['Settled', 'Every other square around it is no mine. Tapping the 1 fills them in.', 'The same board with the 1\'s other seven squares grey.']]],
  ['full', 'A number whose blank squares must all be mines', 'When a number is missing as many mines as it has blank squares.', [
    ['The board', 'A 3 with one mine marked and two blank squares left.', 'A 5 by 4 board, a 3 with one mine marked beside it and two blank squares above it.'],
    ['Spot it', 'The 3 is missing two mines, and has just two blank squares left.', 'The same board with the 3 ringed.'],
    ['Settled', 'Both are mines. Tapping the 3 fills them in.', 'The same board with both blank squares above the 3 marked as mines.']]],
  ['edge', '1-1 against an edge', 'When two 1s sit side by side, the first against the board\'s edge.', [
    ['The board', 'Two 1s side by side, the first against the board\'s edge.', 'A 5 by 4 board with two 1s side by side on its left edge, the row under them grey.'],
    ['Spot it', 'The 1 on the edge has just two blank squares, and the other 1 sees both. So the other 1\'s mine is one of those two.', 'The same board with both 1s ringed.'],
    ['Settled', 'The other 1\'s third blank square is no mine.', 'The same board with the second 1\'s third blank square, above and to its right, grey.']]],
  ['121', '1-2-1 along a row', 'When a 1, a 2 and a 1 sit side by side, with a row of blank squares along them.', [
    ['The board', 'A 1, 2 and 1 side by side, with a row of blank squares along them.', 'A 5 by 4 board with a 1, a 2 and a 1 side by side, and a row of blank squares above them.'],
    ['Spot it', 'A mine over the 2 would fill both 1s and leave the 2 one short. So the square over the 2 is no mine.', 'The same board with the 1, the 2 and the 1 ringed.'],
    ['Settled', 'A mine over each 1, and no mine anywhere else in the row.', 'The same board with a mine marked over each 1, and the rest of the row grey.']]],
  ['1221', '1-2-2-1 along a row', 'When a 1, two 2s and a 1 sit side by side, with a row of blank squares along them.', [
    ['The board', 'A 1, 2, 2 and 1 side by side, with a row of blank squares along them.', 'A 6 by 4 board with a 1, two 2s and a 1 side by side, and a row of blank squares above them.'],
    ['Spot it', 'Each 2 sees one square the 1 beside it doesn\'t, and needs one more mine than that 1. So that square is a mine.', 'The same board with the 1, both 2s and the 1 ringed.'],
    ['Settled', 'A mine over each 2, and no mine anywhere else in the row.', 'The same board with a mine marked over each 2, and the rest of the row grey.']]],
  ['subtract', 'Taking one number\'s mines away from its neighbour\'s', 'When two numbers side by side share some of their squares.', [
    ['The board', 'A 1 beside a 3.', 'A 5 by 4 board with a 1 beside a 3.'],
    ['Spot it', 'The 1\'s one mine is in its two blank squares, and the 3 sees both. Take that mine away and the 3 still needs two more.', 'The same board with the 1 and the 3 ringed.'],
    ['Settled', 'The 3 has just two other blank squares, so both are mines.', 'The same board with the 3\'s other two blank squares, on its right, marked as mines.']]],
];
// Criss-crosses' Basics and Advanced (the product's TASK-221), likewise, from the worksheet's made-up
// shapes. A basic shown in several steps — its picture a row of them — sits under its sentence, across
// the card, rather than beside it; an advanced move's last step is what it settles.
const CRISS_BASICS = [
  ['goal', 'Fit every word into the shape. Every word in the list fills one slot, across or down. Once each is in its own slot, the shape says Solved.', 'A small criss-cross with all seven words in place, Solved under it, and the word count at 7/7.'],
  ['cross', 'Words cross where they share a letter. Where two slots cross they share a square, so both words share its letter: Apple and Pear share this P.', 'Apple across the top and Pear down from its P, the shared P highlighted.'],
  ['given', 'One word starts in place. The starting word is filled in for you, shaded and crossed off the list. It can\'t be moved or taken out.', 'An empty criss-cross with only Apple filled in and shaded, and crossed off the Words card.'],
  ['pick', 'Tap a square to pick a slot. The first tap picks the slot across, and the line over the words says which. Where two slots cross, tap again for the slot down, and again to go back across.', 'The same shape four times: a square circled, then 4 across picked, then 2 down, then 4 across again.', 'wide'],
  ['place', 'Then tap a word to put it in. While a slot is picked, words of other lengths dim. Tap a word that long and it goes in and is crossed off.', '2 down picked with the 4-letter words bright, then Pear in 2 down and crossed off.', 'wide'],
  ['clash', 'A word that clashes won\'t go in. If a word disagrees with letters already in the slot, the clashing squares turn red and it stays out. Lime won\'t fit 2 down: its first square is Apple\'s P.', '2 down picked, then Lime tapped, the P turning red and the line saying Lime doesn\'t fit.', 'wide'],
  ['out', 'Tap a placed word to take it out. Letters another word shares stay: Pear comes out, but Apple\'s P and Green\'s R stay.', 'Pear and Green in place, then Pear taken out, its P and R still there.', 'wide'],
  ['move', 'Moving a word to another slot. With a slot picked, tapping a crossed-off word moves it there. Pear was in 6 across: pick 2 down, tap Pear, and it moves.', 'Pear in 6 across, then 2 down picked, then Pear moved into 2 down.', 'wide'],
  ['noguess', 'No guessing needed. Every shape has exactly one answer, and the letters already in lead to it. A wrong word is never pointed out.', 'The empty criss-cross with only its starting word, Apple, in place.'],
];
const CRISS_MOVES = [
  ['onlylen', 'The only word of its length', 'When one slot is the only one its length, and one word is the only word that long.', [
    ['The puzzle', 'Only the starting word, Apple, is in.', 'The small criss-cross with only Apple in, above the one 3-letter word, Nut.'],
    ['Spot it', '5 down is the only 3-letter slot, and Nut the only 3-letter word.', 'The same shape with 5 down highlighted, and Nut highlighted in the list.'],
    ['Settled', 'Nut goes in 5 down, before any letter crosses it.', 'The same shape with Nut in 5 down, outlined, and crossed off the list.']]],
  ['crossing', 'A crossing letter that leaves one word that fits', 'When a letter already in a slot rules out all but one word its length.', [
    ['The puzzle', 'Lime is in, giving 4 across an E.', 'The small criss-cross with Apple and Lime in, above the 5-letter words Apple, Grape and Green.'],
    ['Spot it', 'Of the 5-letter words left, Grape and Green, only Green has an E fourth.', 'The same shape with 4 across\'s E highlighted, and Green highlighted in the list.'],
    ['Settled', 'Green goes in 4 across.', 'The same shape with Green in 4 across, outlined, and crossed off the list.']]],
  ['nowhere', 'A word that fits nowhere else', 'When no slot has just one word that fits, turn it round: find the word with just one slot.', [
    ['The puzzle', 'The starting word, Ewe, gives 2 across and 4 across each an E at the end.', 'A small criss-cross with Ewe down its right side, above the 5-letter words Horse, Moose and Tiger.'],
    ['Spot it', 'Horse and Moose fit either slot, but Tiger ends in R, so it fits neither.', 'The same shape with both Es highlighted, and Tiger highlighted in the list.'],
    ['Settled', 'Tiger fits nowhere else, so it goes in 1 down.', 'The same shape with Tiger in 1 down, outlined, and crossed off the list.']]],
  ['outward', 'Working out from the starting word', 'When you\'re stuck at the start. The starting word\'s letters are the first clues.', [
    ['The puzzle', 'Only the starting word, Apple, is in.', 'The small criss-cross with only Apple in, above the 4-letter words Date, Lime and Pear.'],
    ['Spot it', 'Apple gives 2 down a P and 3 down an L. Only Pear starts with P, and only Lime with L.', 'The same shape with Apple\'s P and L highlighted.'],
    ['Settled', 'Pear and Lime go in. Their letters now cross 4 across, so keep working out from them.', 'The same shape with Pear in 2 down and Lime in 3 down, both outlined, and crossed off the list.']]],
];
// Mazes' (the product's TASK-219), the same way: its pictures the worksheet's made-up mazes, played
// on the maze page itself — a basic about the pad beside the pad, one about guides above the
// checklist — and a move's last step the route it settles.
const MAZE_BASICS = [
  ['goal', 'Get from the start to the end. Find the one way through, from the shaded start square to End.', 'A small maze with a trail running all the way from the shaded start square to End.'],
  ['pad', 'Move with the control pad. One press of ↓ runs the trail down the corridor and round its bends, and stops at the first junction. The arrow keys work too. A run stops at every junction, dead end and thing on the checklist, so every choice is yours.', 'A small maze with a trail run down from the start to the first junction, beside the control pad with its down key pressed.'],
  ['walls', 'Walls can\'t be crossed. The circled square is right beside the trail, but a wall is in the way, so the pad greys out →. The trail has to go the long way round (dashed).', 'A small maze with a circled square just past a wall from the trail\'s end, a dashed path the long way round to it, and the control pad with its right key greyed out.'],
  ['back', 'Go back over the trail. ↑ ran the trail into a dead end (faded). Back takes it back one run, to the junction it left. Pressing the way it came in does the same. Anything picked up stays ticked.', 'A small maze with a faded trail into a dead end, the trail back at the junction it left, and the control pad with Back pressed.'],
  ['guides', 'Guides are on the right path. Guides sit only on the one route from the start to the end. A run stops on each one, and its box ticks on the checklist.', 'A small maze with the trail stopped on a guide and another guide further on, above the checklist with one of two guide boxes ticked.'],
];
const MAZE_MOVES = [
  ['deadends', 'Fill in dead ends', 'When you can see the whole maze, or you\'ve printed it.', [
    ['The maze', 'Get from the start to the end.', 'A 7 by 7 maze, untouched.'],
    ['Spot it', 'Rule out every dead end, then any square that\'s become a dead end, until none are left (shaded here). On a printed maze, shade them in.', 'The same maze with every dead end shaded grey.'],
    ['Settled', 'What\'s left is the route.', 'The same maze, its dead ends shaded, the trail running through the squares left to End.']]],
  ['workback', 'Work back from the end', 'When the start has lots of choices, but the end looks quiet.', [
    ['The maze', 'Get from the start to the end. From the start there are three junctions to choose at.', 'A 7 by 7 maze, untouched.'],
    ['Spot it', 'From the end, there\'s no junction at all for 23 squares, all the way back to near the start.', 'The same maze with a long corridor from End lit yellow, back to near the start.'],
    ['Settled', 'All that\'s left is the start to that junction: 19 squares to solve, not 43.', 'The same maze with the trail running from the start to End.']]],
  ['waypoint', 'Use a guide as a waypoint', 'When there\'s a guide in the maze.', [
    ['The maze', 'Get from the start to the end. There\'s a guide in the middle.', 'A 7 by 7 maze with one guide in the middle.'],
    ['Spot it', 'The route must pass the guide. Find the start to the guide first: a smaller maze.', 'The same maze with the guide\'s square lit yellow and the trail run from the start to it.'],
    ['Settled', 'Then the guide to the end. Two small mazes make one route.', 'The same maze with the trail running on from the guide to End.']]],
];
// Each kind with its Basics and Advanced written: its basics, its moves, and its three steps'
// picture names.
const RULES = [
  ['wordsearch', 'Wordsearches', WORDSEARCH_BASICS, WORDSEARCH_MOVES, ['puzzle', 'spot', 'found']],
  ['maze', 'Mazes', MAZE_BASICS, MAZE_MOVES, ['puzzle', 'spot', 'found']],
  ['minesweeper', 'Minesweeper', MINESWEEPER_BASICS, MINESWEEPER_MOVES, ['puzzle', 'spot', 'settled']],
  ['crisscross', 'Criss-crosses', CRISS_BASICS, CRISS_MOVES, ['puzzle', 'spot', 'settled']],
];
const PLAY_PAGES = [
  ['/app/play.html?id=WSCH-0001', 'wordsearch', 'Wordsearches'],
  ['/app/maze.html?id=MAZE-0001', 'maze', 'Mazes'],
  ['/app/minesweeper.html?id=MINE-0001', 'minesweeper', 'Minesweeper'],
  ['/app/crisscross.html?id=CRSS-0001', 'crisscross', 'Criss-cross'],
  ['/app/mosaic.html?id=MOSA-0001', 'mosaic', 'Mosaic'],
];

test.beforeEach(async ({ context }) => {
  await context.addInitScript(() => { window.print = () => {}; });
  await context.route('https://vxschtygvtilsadgixec.supabase.co/**', route => route.abort());
});

const side = page => page.locator('#site-side');
const shown = page => page.locator('main .part:not([hidden])');
const pill = (page, name) => page.getByRole('tab', { name });

for (const address of ['/app/', '/app/about.html', '/app/how-to-play.html?kind=maze', '/app/collection.html?slug=issue-1-remake']) {
  test(`on ${address}, each kind in the side bar has a book icon opening its How to play page; its name still browses it`, async ({ page, baseURL }) => {
    await page.goto(address);
    await expect(side(page).locator('.kind-row .rules')).toHaveCount(KINDS.length);
    for (const [kind, name] of KINDS) {
      const icon = side(page).getByRole('link', { name: `How to play ${name}` });
      await expect(icon).toHaveAttribute('href', `how-to-play.html?kind=${kind}`);
      await expect(icon.locator('svg')).toBeVisible();
    }
    await expect(side(page).locator('.kind').nth(1)).toHaveAttribute('href', 'index.html?kind=maze');
    await side(page).getByRole('link', { name: 'How to play Minesweeper' }).click();
    await expect(page).toHaveURL(`${baseURL}/app/how-to-play.html?kind=minesweeper`);
    await expect(page.locator('h1')).toHaveText('How to play Minesweeper');
  });
}

test('each book icon sits on its kind\'s row, at its right', async ({ page }) => {
  await page.goto('/app/');
  for (const [, name] of KINDS) {
    const row = side(page).locator('.kind-row', { has: page.getByRole('link', { name: `How to play ${name}` }) });
    const kind = await row.locator('.kind').boundingBox();
    const icon = await row.locator('.rules').boundingBox();
    expect(icon.x).toBeGreaterThanOrEqual(kind.x + kind.width - 1);
    expect(Math.abs((icon.y + icon.height / 2) - (kind.y + kind.height / 2))).toBeLessThan(2);
  }
});

test('the side bar no longer lists How to play among its pages', async ({ page }) => {
  await page.goto('/app/');
  await expect(side(page).locator('.page')).toHaveText(['Saving your progress', 'About us', 'Unofficial', 'Feedback', 'Privacy']);
  await expect(side(page).locator('.page', { hasText: 'How to play' })).toHaveCount(0);
});

test.describe('on a phone', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('the drawer\'s kinds each have their book icon, opening the kind\'s page', async ({ page, baseURL }) => {
    await page.goto('/app/');
    await page.locator('.site .burger').click();
    await expect(side(page).locator('.kind-row .rules:visible')).toHaveCount(KINDS.length);
    await side(page).getByRole('link', { name: 'How to play Mazes' }).click();
    await expect(page).toHaveURL(`${baseURL}/app/how-to-play.html?kind=maze`);
    await expect(page.locator('h1')).toHaveText('How to play Mazes');
  });
});

for (const [kind, name, types] of KINDS) {
  test(`${name}' page opens on Basics, then Advanced, then Variants holds its types in order, worded as the owner wrote them`, async ({ page }) => {
    await page.goto(`/app/how-to-play.html?kind=${kind}`);
    await expect(page).toHaveTitle(`How to play ${name} · Grew Puzzles`);
    await expect(page.getByRole('tab')).toHaveText(['Basics', 'Advanced', 'Variants']);
    await expect(pill(page, 'Basics')).toHaveAttribute('aria-selected', 'true');
    await expect(shown(page)).toHaveCount(1);
    await expect(shown(page)).toHaveAttribute('data-part', 'basics');
    await expect(shown(page)).toHaveAttribute('data-kind', kind);
    await pill(page, 'Advanced').click();
    await expect(pill(page, 'Advanced')).toHaveAttribute('aria-selected', 'true');
    await expect(pill(page, 'Basics')).toHaveAttribute('aria-selected', 'false');
    await expect(shown(page)).toHaveAttribute('data-part', 'advanced');
    await pill(page, 'Variants').click();
    await expect(shown(page)).toHaveAttribute('data-part', 'variants');
    await expect(shown(page)).toHaveAttribute('data-kind', kind);
    await expect(page.locator('main section:visible')).toHaveCount(types.length);
    expect(await page.locator('main section:visible').evaluateAll(s => s.map(e => e.id))).toEqual(types.map(([id]) => id));
    await expect(page.locator('main section:visible h2')).toHaveText(types.map(([, , heading]) => heading));
    await expect(page.locator('main section:visible p')).toHaveText(types.map(([, , , words]) => words));
  });
}

test('Variants\' pictures are each type\'s own, its alt text naming the type and what it shows', async ({ page }) => {
  for (const [kind, , types] of KINDS) {
    await page.goto(`/app/how-to-play.html?kind=${kind}`);
    await pill(page, 'Variants').click();
    for (const [id, , , , alt] of types) {
      const picture = page.locator(`#${id} img`);
      await expect(picture).toHaveAttribute('src', `../content/how-to-play/${id}.png`);
      await expect(picture).toHaveAttribute('alt', alt);
      expect(await picture.evaluate(img => img.complete && img.naturalWidth > 0)).toBe(true);
    }
  }
});

const loaded = img => img.evaluate(i => i.complete && i.naturalWidth > 0);

for (const [kind, name, basics, moves, stepNames] of RULES) {
  test(`${name} opens on Basics: each basic a sentence beside its picture — under it, one in several steps — in the owner's words`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(`/app/how-to-play.html?kind=${kind}`);
    await expect(shown(page)).toHaveAttribute('data-part', 'basics');
    await expect(shown(page).locator('.rule')).toHaveCount(basics.length);
    await expect(shown(page).locator('.rule p')).toHaveText(basics.map(([, words]) => words));
    for (const [id, , alt, wide] of basics) {
      const picture = page.locator(`#${kind}-${id} img`);
      await expect(picture).toHaveAttribute('src', `../content/how-to-play/${kind}-${id}.png`);
      await expect(picture).toHaveAttribute('alt', alt);
      expect(await loaded(picture)).toBe(true);
      const box = await picture.boundingBox(), words = await page.locator(`#${kind}-${id} p`).boundingBox();
      if (wide) {
        expect(words.y + words.height).toBeLessThanOrEqual(box.y);
        expect(box.width).toBeGreaterThan(words.width / 2);
      } else {
        expect(box.x + box.width).toBeLessThan(words.x);
        expect(words.y).toBeLessThan(box.y + box.height);
      }
    }
  });

  test(`${name}' Advanced: each move named, when it happens, then the puzzle, how it's spotted and what it finds in a row, each captioned`, async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto(`/app/how-to-play.html?kind=${kind}`);
    await pill(page, 'Advanced').click();
    await expect(shown(page).locator('.move')).toHaveCount(moves.length);
    await expect(shown(page).locator('.move h2')).toHaveText(moves.map(([, title]) => title));
    await expect(shown(page).locator('.move > p')).toHaveText(moves.map(([, , when]) => when));
    for (const [id, , , steps] of moves) {
      const figures = page.locator(`#${kind}-${id} figure`);
      await expect(figures.locator('figcaption')).toHaveText(steps.map(([label, words]) => `${label} ${words}`));
      await expect(figures.locator('figcaption b')).toHaveText(steps.map(([label]) => label));
      const boxes = [];
      for (const [i, [, , alt]] of steps.entries()) {
        const picture = figures.nth(i).locator('img');
        await expect(picture).toHaveAttribute('src', `../content/how-to-play/${kind}-${id}-${stepNames[i]}.png`);
        await expect(picture).toHaveAttribute('alt', alt);
        expect(await loaded(picture)).toBe(true);
        boxes.push(await picture.boundingBox());
      }
      expect(boxes.map(b => Math.round(b.y))).toEqual(boxes.map(() => Math.round(boxes[0].y)));
      expect(boxes[0].x + boxes[0].width).toBeLessThan(boxes[1].x);
      expect(boxes[1].x + boxes[1].width).toBeLessThan(boxes[2].x);
    }
  });

  test.describe(`on a phone, ${name}' rules`, () => {
    test.use({ viewport: { width: 375, height: 700 } });

    test('a move\'s three pictures stack top to bottom in order, each with its caption under it', async ({ page }) => {
      await page.goto(`/app/how-to-play.html?kind=${kind}`);
      await pill(page, 'Advanced').click();
      for (const [id] of moves) {
        const figures = page.locator(`#${kind}-${id} figure`);
        let below = 0;
        for (let i = 0; i < stepNames.length; i++) {
          const picture = await figures.nth(i).locator('img').boundingBox();
          const caption = await figures.nth(i).locator('figcaption').boundingBox();
          expect(picture.y).toBeGreaterThanOrEqual(below);
          expect(caption.y).toBeGreaterThanOrEqual(picture.y + picture.height);
          below = caption.y + caption.height;
        }
      }
    });

    test('a basic\'s picture sits above its sentence — under it, one in several steps', async ({ page }) => {
      await page.goto(`/app/how-to-play.html?kind=${kind}`);
      for (const [id, , , wide] of basics) {
        const picture = await page.locator(`#${kind}-${id} img`).boundingBox();
        const words = await page.locator(`#${kind}-${id} p`).boundingBox();
        if (wide) expect(words.y + words.height).toBeLessThanOrEqual(picture.y);
        else expect(picture.y + picture.height).toBeLessThanOrEqual(words.y);
      }
    });

    test('Basics and Advanced read without scrolling sideways', async ({ page }) => {
      await page.setViewportSize({ width: 320, height: 640 });
      await page.goto(`/app/how-to-play.html?kind=${kind}`);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
      await pill(page, 'Advanced').click();
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
    });
  });
}

test('a part with nothing written yet is still a pill, and shows empty — no heading, no coming soon', async ({ page }) => {
  await page.goto('/app/how-to-play.html?kind=mosaic');
  for (const name of ['Basics', 'Advanced', 'Variants']) {
    await pill(page, name).click();
    await expect(shown(page)).toHaveCount(1);
    await expect(shown(page)).toBeEmpty();
  }
  await expect(page.locator('main .page-card')).not.toContainText(/coming soon/i);
});

test('an address naming no kind the site has opens Wordsearches\' page', async ({ page }) => {
  for (const address of ['/app/how-to-play.html', '/app/how-to-play.html?kind=nope']) {
    await page.goto(address);
    await expect(page.locator('h1')).toHaveText('How to play Wordsearches');
    await expect(shown(page)).toHaveAttribute('data-kind', 'wordsearch');
  }
});

test('on a kind\'s How to play page, that kind is the side bar\'s current entry', async ({ page }) => {
  await page.goto('/app/how-to-play.html?kind=maze');
  await expect(side(page).locator('.kind[aria-current="page"]')).toHaveCount(1);
  await expect(side(page).locator('.kind[aria-current="page"]')).toContainText('Mazes');
});

for (const [address, kind, name] of PLAY_PAGES) {
  test(`${address} wears its kind's book icon, opening its How to play page on Basics`, async ({ page, baseURL }) => {
    await page.goto(address);
    const icon = page.locator('.play-rules').getByRole('link', { name: `How to play ${name}` });
    await expect(icon).toBeVisible();
    await icon.click();
    await expect(page).toHaveURL(`${baseURL}/app/how-to-play.html?kind=${kind}`);
    await expect(pill(page, 'Basics')).toHaveAttribute('aria-selected', 'true');
  });
}

for (const [width, height] of [[1440, 900], [320, 640]]) {
  test(`at ${width}px wide a play page's book icon sits at its title's right, never over it`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    for (const [address] of PLAY_PAGES) {
      await page.goto(address);
      await expect(page.locator('.play-rules + .play-head h1')).not.toBeEmpty();
      const icon = await page.locator('.play-rules .rules').boundingBox();
      const title = await page.locator('.play-rules + .play-head h1').boundingBox();
      expect(icon.x).toBeGreaterThanOrEqual(title.x + title.width);
      expect(icon.y).toBeLessThan(title.y + title.height);
    }
  });
}

test('a play page\'s book icon never prints', async ({ page }) => {
  await page.goto('/app/play.html?id=WSCH-0001');
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('.play-rules')).toBeHidden();
});

test('on a wide screen each Variants picture sits beside its words, alternating sides down the page', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/app/how-to-play.html?kind=maze');
  await pill(page, 'Variants').click();
  const sides = [];
  for (const [id] of MAZE_TYPES) {
    const picture = await page.locator(`#${id} img`).boundingBox();
    const words = await page.locator(`#${id} .type-words`).boundingBox();
    expect(picture.y).toBeLessThan(words.y + words.height);
    expect(words.y).toBeLessThan(picture.y + picture.height);
    sides.push(picture.x < words.x ? 'left' : 'right');
  }
  expect(sides).toEqual(MAZE_TYPES.map((_, i) => (i % 2 ? 'right' : 'left')));
});

test('on a phone each Variants picture sits above its words', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 700 });
  await page.goto('/app/how-to-play.html?kind=wordsearch');
  await pill(page, 'Variants').click();
  for (const [id] of WORDSEARCH_TYPES) {
    const picture = await page.locator(`#${id} img`).boundingBox();
    const words = await page.locator(`#${id} .type-words`).boundingBox();
    expect(picture.y + picture.height).toBeLessThanOrEqual(words.y);
  }
});

test('the How to play page wears the site bar, and its words sit on the card with a character, Themed', async ({ page }) => {
  await page.goto('/app/how-to-play.html?kind=wordsearch');
  await expect(page.locator('.site .brand')).toHaveText('Grew Puzzles');
  await pill(page, 'Variants').click();
  await expect(page.locator('.page-card section:visible')).toHaveCount(WORDSEARCH_TYPES.length);
  await expect(page.locator('#name-tag')).not.toBeEmpty();
  await expect(page.locator('#theme-figure')).toBeVisible();
});

test('Plain, the How to play page shows no character', async ({ page }) => {
  await page.goto('/app/how-to-play.html?kind=wordsearch');
  await page.locator('#site-side .look select').selectOption('plain');
  await expect(page.locator('#theme-figure')).toBeHidden();
  await expect(page.locator('#name-tag')).toBeHidden();
});

test('on a wide screen the pills sit centred under the title', async ({ page }) => {
  await page.goto('/app/how-to-play.html?kind=minesweeper');
  const title = await page.locator('h1').boundingBox();
  const pills = await page.locator('.part-pills').boundingBox();
  expect(pills.y).toBeGreaterThan(title.y + title.height);
  expect(Math.abs((pills.x + pills.width / 2) - (title.x + title.width / 2))).toBeLessThan(2);
});

test('on the narrowest phone the How to play page and its pills read without scrolling sideways', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto('/app/how-to-play.html?kind=crisscross');
  await expect(page.locator('h1')).toBeVisible();
  await expect(pill(page, 'Variants')).toBeInViewport({ ratio: 1 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(320);
});
