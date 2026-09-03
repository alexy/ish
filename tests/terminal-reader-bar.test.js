const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const controller = fs.readFileSync(
    path.join(root, 'app', 'TerminalViewController.m'), 'utf8');
const terminalSource = fs.readFileSync(
    path.join(root, 'app', 'terminal', 'term.js'), 'utf8');

assert.match(controller,
    /CGFloat height = showReaderBar \? 42 \+ self\.view\.safeAreaInsets\.bottom : 0;/);
assert.match(controller,
    /self\.readerBarHeight\.constant = height;/);
assert.doesNotMatch(controller, /self\.readerTermBottom\.active\s*=/,
    'the terminal-to-bar constraint must stay active while visibility changes');
assert.doesNotMatch(controller, /self\.bottomConstraint\.active\s*=\s*YES/,
    'do not reactivate the weak storyboard constraint after removing it');
assert.match(controller, /\[self\.termView refreshTerminalLayout\];/);

const refresh = terminalSource.match(
    /exports\.refreshLayout = \(\) => \{([\s\S]*?)\n\};/);
assert.ok(refresh, 'term.js exports the post-layout refresh');

const calls = [];
const term = {
    scrollPort_: {
        resize: () => calls.push('resize'),
        scheduleInvalidate: () => calls.push('invalidate'),
        scheduleRedraw: () => calls.push('redraw'),
    },
    scheduleSyncCursorPosition_: () => calls.push('cursor'),
};
const exportsObject = {getSize: () => [80, 24]};
const result = new Function('term', 'exports', refresh[1])(term, exportsObject);

assert.deepEqual(calls, ['resize', 'invalidate', 'redraw', 'cursor']);
assert.deepEqual(result, [80, 24]);

console.log('terminal Reader bar tests passed');
