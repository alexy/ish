#!/usr/bin/env node

'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const source = fs.readFileSync(
    path.join(__dirname, '..', 'app', 'terminal', 'term.js'), 'utf8');
const start = source.indexOf('const terminalMouseReporting = () =>');
const end = source.indexOf('exports.setFocused =', start);
assert.notEqual(start, -1, 'touch implementation start not found');
assert.notEqual(end, -1, 'touch implementation end not found');
const implementation = source.slice(start, end);

class FakeMouseEvent {
    constructor(type, options = {}) {
        this.type = type;
        this.defaultPrevented = false;
        this.propagationStopped = false;
        Object.assign(this, options);
    }

    preventDefault() {
        this.defaultPrevented = true;
    }

    stopImmediatePropagation() {
        this.propagationStopped = true;
    }
}

class FakeWheelEvent extends FakeMouseEvent {}
FakeWheelEvent.DOM_DELTA_LINE = 1;

const makeTouch = (identifier, clientX, clientY) => ({
    identifier,
    clientX,
    clientY,
});

const makeTouchEvent = (touches, changedTouches) => ({
    touches,
    changedTouches,
    defaultPrevented: false,
    propagationStopped: false,
    preventDefault() {
        this.defaultPrevented = true;
    },
    stopImmediatePropagation() {
        this.propagationStopped = true;
    },
});

const makeHarness = () => {
    const screenListeners = new Map();
    const documentListeners = new Map();
    const reports = [];
    const nativeCalls = [];
    const terminalDocument = {
        defaultView: {
            MouseEvent: FakeMouseEvent,
            WheelEvent: FakeWheelEvent,
        },
        addEventListener(type, listener) {
            documentListeners.set(type, listener);
        },
    };
    const term = {
        vt: {
            mouseReport: 2,
            MOUSE_REPORT_DISABLED: 0,
            lastMouseDragResponse_: null,
        },
        scrollPort_: {
            characterSize: {height: 20},
            screen_: {
                addEventListener(type, listener) {
                    screenListeners.set(type, listener);
                },
            },
        },
        getDocument() {
            return terminalDocument;
        },
        onMouse_(event) {
            reports.push({
                type: event.type,
                clientX: event.clientX,
                clientY: event.clientY,
                deltaMode: event.deltaMode,
                deltaY: event.deltaY,
            });
        },
    };
    const native = new Proxy({}, {
        get(_target, name) {
            return (value) => nativeCalls.push({name, value});
        },
    });
    const document = {
        getSelection() {
            return {rangeCount: 0, isCollapsed: true};
        },
    };
    const load = new Function(
        'term', 'native', 'performance', 'document',
        'terminalTouchAllMotion', implementation);
    load(term, native, {now: () => 100}, document, true);
    return {screenListeners, reports, nativeCalls};
};

const dispatch = (harness, type, touches, changedTouches) => {
    const event = makeTouchEvent(touches, changedTouches);
    harness.screenListeners.get(type)(event);
    assert.equal(event.defaultPrevented, true, `${type} was not consumed`);
    assert.equal(event.propagationStopped, true,
        `${type} propagation was not stopped`);
};

{
    const harness = makeHarness();
    const startTouch = makeTouch(1, 80, 160);
    dispatch(harness, 'touchstart', [startTouch], [startTouch]);
    assert.deepEqual(harness.reports, [], 'tap fired before release');
    const endTouch = makeTouch(1, 83, 166);
    dispatch(harness, 'touchend', [], [endTouch]);
    assert.deepEqual(harness.reports, [
        {type: 'mousemove', clientX: 80, clientY: 160,
            deltaMode: undefined, deltaY: undefined},
        {type: 'mousedown', clientX: 80, clientY: 160,
            deltaMode: undefined, deltaY: undefined},
        {type: 'mouseup', clientX: 80, clientY: 160,
            deltaMode: undefined, deltaY: undefined},
    ], 'tap did not remain on its touch-down cell');
}

{
    const harness = makeHarness();
    const startTouch = makeTouch(2, 90, 180);
    dispatch(harness, 'touchstart', [startTouch], [startTouch]);
    const driftTouch = makeTouch(2, 90, 169);
    dispatch(harness, 'touchmove', [driftTouch], [driftTouch]);
    assert.deepEqual(harness.reports, [], 'sub-threshold drift scrolled');
    dispatch(harness, 'touchend', [], [driftTouch]);
    assert.deepEqual(harness.reports.map((report) => report.type),
        ['mousemove', 'mousedown', 'mouseup'],
        'sub-threshold drift was not retained as a tap');
}

{
    const harness = makeHarness();
    const startTouch = makeTouch(3, 100, 200);
    dispatch(harness, 'touchstart', [startTouch], [startTouch]);
    const movedTouch = makeTouch(3, 100, 170);
    dispatch(harness, 'touchmove', [movedTouch], [movedTouch]);
    dispatch(harness, 'touchend', [], [movedTouch]);
    assert.deepEqual(harness.reports, [
        {type: 'wheel', clientX: 100, clientY: 200,
            deltaMode: 1, deltaY: 1},
        {type: 'wheel', clientX: 100, clientY: 200,
            deltaMode: 1, deltaY: 1},
    ], 'upward drag did not become natural-direction wheel-down reports');
}

{
    const harness = makeHarness();
    const startTouch = makeTouch(4, 110, 210);
    dispatch(harness, 'touchstart', [startTouch], [startTouch]);
    const movedTouch = makeTouch(4, 110, 240);
    dispatch(harness, 'touchmove', [movedTouch], [movedTouch]);
    dispatch(harness, 'touchend', [], [movedTouch]);
    assert.deepEqual(harness.reports, [
        {type: 'wheel', clientX: 110, clientY: 210,
            deltaMode: 1, deltaY: -1},
        {type: 'wheel', clientX: 110, clientY: 210,
            deltaMode: 1, deltaY: -1},
    ], 'downward drag did not become natural-direction wheel-up reports');
}

console.log('terminal touch gesture tests passed');
