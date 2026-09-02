hterm.defaultStorage = new lib.Storage.Memory();
window.onload = async function() {
    await lib.init();
    window.term = new hterm.Terminal();

    // Do not expose hterm's fallback face or transparent bootstrap colors.
    // The first native style update reveals the terminal after its webfont
    // and cell geometry have settled.
    document.getElementById('terminal').style.visibility = 'hidden';
    term.getPrefs().set('background-color', 'transparent');

    term.getPrefs().set('terminal-encoding', 'iso-2022');
    term.getPrefs().set('enable-resize-status', false);
    term.getPrefs().set('copy-on-select', false);
    term.getPrefs().set('enable-clipboard-notice', false);
    term.getPrefs().set('user-css-text', termCss);
    term.getPrefs().set('screen-padding-size', 4);
    // Creating and preloading the <audio> element for this sometimes hangs WebKit on iOS 16 for some reason. Can be most easily reproduced by resetting a simulator and starting the app. System logs show Fig hanging while trying to do work.
    term.getPrefs().set('audible-bell-sound', '');

    term.onTerminalReady = onTerminalReady;
    term.decorate(document.getElementById('terminal'));
};

var termCss = `
@font-face {
  font-family: '1Unix PragmataPro';
  src: url('PragmataPro.ttf') format('truetype'), local('PragmataPro');
  font-style: normal;
  font-weight: 400;
}
@font-face {
  font-family: '1Unix PragmataPro';
  src: url('PragmataPro-I.ttf') format('truetype'), local('PragmataPro-Italic');
  font-style: italic;
  font-weight: 400;
}
@font-face {
  font-family: '1Unix PragmataPro';
  src: url('PragmataPro-B.ttf') format('truetype'), local('PragmataPro-Bold');
  font-style: normal;
  font-weight: 700;
}
@font-face {
  font-family: '1Unix PragmataPro';
  src: url('PragmataPro-Z.ttf') format('truetype'), local('PragmataPro-Bold-Italic');
  font-style: italic;
  font-weight: 700;
}
@font-face {
  font-family: '1Unix JetBrains Mono';
  src: url('JetBrainsMono-Regular.ttf') format('truetype'), local('JetBrainsMono-Regular');
  font-style: normal;
  font-weight: 400;
}
@font-face {
  font-family: '1Unix JetBrains Mono';
  src: url('JetBrainsMono-Italic.ttf') format('truetype'), local('JetBrainsMono-Italic');
  font-style: italic;
  font-weight: 400;
}
@font-face {
  font-family: '1Unix JetBrains Mono';
  src: url('JetBrainsMono-Bold.ttf') format('truetype'), local('JetBrainsMono-Bold');
  font-style: normal;
  font-weight: 700;
}
@font-face {
  font-family: '1Unix JetBrains Mono';
  src: url('JetBrainsMono-Bold-Italic.ttf') format('truetype'), local('JetBrainsMono-BoldItalic');
  font-style: italic;
  font-weight: 700;
}
x-screen {
    background: transparent !important;
    overflow: hidden !important;
    -webkit-tap-highlight-color: transparent;
}
x-row {
  font-kerning: none;
  font-variant-ligatures: none;
  font-feature-settings: "kern" 0, "liga" 0, "calt" 0;
}
.uri-node {
  text-decoration: underline;
}
`;

function onTerminalReady() {

// Shorthand for JS -> native IPC
const native = new Proxy({}, {
    get(obj, prop) {
        return (...args) => {
            if (args.length == 0)
                args = null;
            else if (args.length == 1)
                args = args[0];
            webkit.messageHandlers[prop].postMessage(args);
        };
    },
});

// Functions for native -> JS
window.exports = {};

term.io.push();
term.reset();

// This hterm predates DECSET 1003 (all-motion mouse tracking).  TTY menus in
// Emacs use that mode to update the active row before accepting a click.  A
// touchscreen has no hover phase, so treat 1003 as drag tracking and send one
// synthetic movement at touch-down below.
const originalSetDECMode = term.vt.setDECMode.bind(term.vt);
term.vt.setDECMode = function(code, state) {
    if (parseInt(code, 10) == 1003) {
        this.mouseReport = state ?
            this.MOUSE_REPORT_DRAG : this.MOUSE_REPORT_DISABLED;
        this.terminal.syncMouseStyle();
        return;
    }
    originalSetDECMode(code, state);
};

let oldProps = {};
function syncProp(name, value) {
    if (oldProps[name] !== value)
        native.propUpdate(name, value);
}
let decoder = new TextDecoder();
exports.write = (data) => {
    term.io.writeUTF16(decoder.decode(lib.codec.stringToCodeUnitArray(data)));
    syncProp('applicationCursor', term.keyboard.applicationCursor);
};
term.io.sendString = term.io.onVTKeyStroke = (data) => {
    native.sendInput(data);
};

// hterm size updates native size
term.io.onTerminalResize = () => native.resize();
exports.getSize = () => [term.screenSize.width, term.screenSize.height];

// selection, copying
term.scrollPort_.screen_.contentEditable = false;
term.blur();
term.focus();
exports.copy = () => term.copySelectionToClipboard();

// focus
// This listener blocks blur events that come in because the webview has lost first responder
term.scrollPort_.screen_.addEventListener('blur', (e) => {
    if (e.target.ownerDocument.activeElement == e.target) {
        e.stopPropagation();
    }
}, {capture: true});
const terminalMouseReporting = () =>
    term.vt.mouseReport != term.vt.MOUSE_REPORT_DISABLED;
let terminalTouchIdentifier = null;
let terminalTouchPoint = null;
let suppressCompatibilityMouseUntil = 0;
const changedTouch = (e, identifier) => {
    for (let i = 0; i < e.changedTouches.length; ++i) {
        const touch = e.changedTouches[i];
        if (touch.identifier == identifier) return touch;
    }
    return null;
};
const rememberTouchPoint = (touch) => {
    terminalTouchPoint = {
        clientX: touch.clientX,
        clientY: touch.clientY,
    };
};
const reportTouchAsMouse = (type, point, buttons) => {
    const MouseEvent = term.getDocument().defaultView.MouseEvent;
    const mouseEvent = new MouseEvent(type, {
        bubbles: false,
        cancelable: true,
        button: 0,
        buttons: buttons,
        clientX: point.clientX,
        clientY: point.clientY,
    });
    term.onMouse_(mouseEvent);
    if (type != 'mousemove') {
        native.log({
            event: 'terminal-touch',
            type: type,
            clientX: point.clientX,
            clientY: point.clientY,
            row: mouseEvent.terminalRow,
            column: mouseEvent.terminalColumn,
        });
    }
};
const suppressCompatibilityMouse = (e) => {
    if (performance.now() >= suppressCompatibilityMouseUntil) return;
    if (e.type != 'mousemove') {
        native.log({
            event: 'suppressed-compatibility-mouse',
            type: e.type,
            clientX: e.clientX,
            clientY: e.clientY,
        });
    }
    e.preventDefault();
    e.stopImmediatePropagation();
};
['mousedown', 'mouseup', 'mousemove', 'click'].forEach((type) => {
    // hterm listens on the whole iframe document as well as the screen and
    // cursor. iOS may target its compatibility event at any of those nodes.
    term.getDocument().addEventListener(type, suppressCompatibilityMouse,
        {capture: true});
});
term.scrollPort_.screen_.addEventListener('touchstart', (e) => {
    if (terminalMouseReporting() && e.touches.length == 2) {
        suppressCompatibilityMouseUntil = performance.now() + 1000;
        if (terminalTouchPoint != null) {
            reportTouchAsMouse('mouseup', terminalTouchPoint, 0);
        }
        terminalTouchIdentifier = null;
        terminalTouchPoint = null;
        e.preventDefault();
        e.stopImmediatePropagation();
        native.focus({force: true});
    } else if (terminalMouseReporting() && e.touches.length == 1 &&
               e.changedTouches.length == 1) {
        suppressCompatibilityMouseUntil = performance.now() + 1000;
        const touch = e.changedTouches[0];
        terminalTouchIdentifier = touch.identifier;
        rememberTouchPoint(touch);
        e.preventDefault();
        e.stopImmediatePropagation();
        // TTY popup menus select from their last pointer-movement position.
        // A tap begins in place, so report that position before the press.
        term.vt.lastMouseDragResponse_ = null;
        reportTouchAsMouse('mousemove', terminalTouchPoint, 1);
        reportTouchAsMouse('mousedown', terminalTouchPoint, 1);
        native.focus({mouseReporting: true});
    }
}, {capture: true, passive: false});
term.scrollPort_.screen_.addEventListener('touchmove', (e) => {
    if (terminalTouchIdentifier == null) return;
    const touch = changedTouch(e, terminalTouchIdentifier);
    if (touch == null) return;
    rememberTouchPoint(touch);
    suppressCompatibilityMouseUntil = performance.now() + 1000;
    e.preventDefault();
    e.stopImmediatePropagation();
    reportTouchAsMouse('mousemove', terminalTouchPoint, 1);
}, {capture: true, passive: false});
term.scrollPort_.screen_.addEventListener('touchend', (e) => {
    if (terminalTouchIdentifier == null) return;
    const touch = changedTouch(e, terminalTouchIdentifier);
    if (touch != null) rememberTouchPoint(touch);
    suppressCompatibilityMouseUntil = performance.now() + 1000;
    e.preventDefault();
    e.stopImmediatePropagation();
    reportTouchAsMouse('mouseup', terminalTouchPoint, 0);
    terminalTouchIdentifier = null;
    terminalTouchPoint = null;
}, {capture: true, passive: false});
term.scrollPort_.screen_.addEventListener('touchcancel', (e) => {
    if (terminalTouchIdentifier == null) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    suppressCompatibilityMouseUntil = performance.now() + 1000;
    if (terminalTouchPoint != null) {
        reportTouchAsMouse('mouseup', terminalTouchPoint, 0);
    }
    terminalTouchIdentifier = null;
    terminalTouchPoint = null;
}, {capture: true, passive: false});
term.scrollPort_.screen_.addEventListener('mousedown', (e) => {
    // Taps while there is a selection should be left to the selection view
    if ((document.getSelection().rangeCount != 0) &&
        (!document.getSelection().isCollapsed)) return;
    native.focus({mouseReporting: terminalMouseReporting()});
});
exports.setFocused = (focus) => {
    if (focus)
        term.focus();
    else
        term.blur();
};
term.scrollPort_.screen_.addEventListener('focus', (e) => native.syncFocus());

// scrolling
// Disable hterm builtin touch scrolling
term.scrollPort_.onTouch = (e) => {
    // Convince hterm that we called preventDefault() and that it shouldn't do more handling, but don't actually call it because that would break text selection
    Object.defineProperty(e, 'defaultPrevented', {value: true});
};
// Scroll to bottom wrapper
exports.scrollToBottom = () => term.scrollEnd();
// Set scroll position
exports.newScrollTop = (y) => {
    // two lines instead of one because the value you read out of scrollTop can be different from the value you write into it
    term.scrollPort_.screen_.scrollTop = y;
    lastScrollTop = term.scrollPort_.screen_.scrollTop;
};

// Send scroll height and position to native code
let lastScrollHeight, lastScrollTop;
function syncScroll() {
    const scrollHeight = parseFloat(term.scrollPort_.scrollArea_.style.height);
    if (scrollHeight != lastScrollHeight)
        native.newScrollHeight(scrollHeight);
    lastScrollHeight = scrollHeight;

    const scrollTop = term.scrollPort_.screen_.scrollTop;
    if (scrollTop != lastScrollTop)
        native.newScrollTop(scrollTop);
    lastScrollTop = scrollTop;
}

const realSyncScrollHeight = hterm.ScrollPort.prototype.syncScrollHeight;
hterm.ScrollPort.prototype.syncScrollHeight = function() {
    realSyncScrollHeight.call(this);
    syncScroll();
};
term.scrollPort_.screen_.addEventListener('scroll', syncScroll);

let fontSyncRevision = 0;
const fontFaceFamilies = {
    'JetBrains Mono': '1Unix JetBrains Mono',
    'PragmataPro': '1Unix PragmataPro',
};
const syncFontMetricsWhenReady = (fontFamily, fontSize, foregroundColor,
                                  backgroundColor) => {
    const revision = ++fontSyncRevision;
    const fontFaceFamily = fontFaceFamilies[fontFamily];
    const fontSet = term.getDocument().fonts;
    const finish = (loaded) => {
        if (revision != fontSyncRevision) return;
        // Reapply the complete visual state after the face is available. This
        // avoids retaining a transparent or fallback-font raster from hterm's
        // bootstrap paint on WKWebView process launches.
        term.setBackgroundColor(backgroundColor);
        term.setForegroundColor(foregroundColor);
        term.setCursorColor(foregroundColor);
        term.syncFontFamily();
        term.setFontSize(fontSize);
        term.scrollPort_.scheduleInvalidate();
        term.scrollPort_.scheduleRedraw();
        term.scheduleSyncCursorPosition_();
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                if (revision != fontSyncRevision) return;
                document.getElementById('terminal').style.visibility =
                    'visible';
                native.fontMetricsReady({
                    family: term.getFontFamily(),
                    loaded: loaded,
                    foregroundColor: term.getForegroundColor(),
                    backgroundColor: term.getBackgroundColor(),
                    width: term.scrollPort_.characterSize.width,
                    height: term.scrollPort_.characterSize.height,
                });
            });
        });
    };

    if (fontFaceFamily == null || fontSet == null ||
        typeof fontSet.load != 'function') {
        finish(false);
        return;
    }

    const face = `${fontSize}px '${fontFaceFamily}'`;
    Promise.all([
        fontSet.load(face, 'MMMMMMMM'),
        fontSet.load(`bold ${face}`, 'MMMMMMMM'),
        fontSet.ready,
    ]).then(() => finish(fontSet.check(face, 'MMMMMMMM')))
      .catch(() => finish(false));
};

exports.updateStyle = ({foregroundColor, backgroundColor, fontFamily, fontSize, colorPaletteOverrides, blinkCursor, cursorShape}) => {
    const fontAliases = {
        'JetBrains Mono': "'1Unix JetBrains Mono', 'JetBrains Mono', monospace",
        'PragmataPro': "'1Unix PragmataPro', 'PragmataPro', monospace",
    };
    const resolvedFontFamily = fontAliases[fontFamily] || fontFamily;
    term.getPrefs().set('background-color', backgroundColor);
    term.getPrefs().set('foreground-color', foregroundColor);
    term.getPrefs().set('cursor-color', foregroundColor);
    term.getPrefs().set('font-family', resolvedFontFamily);
    term.getPrefs().set('font-size', fontSize);
    term.getPrefs().set('color-palette-overrides', colorPaletteOverrides);
    term.getPrefs().set('cursor-blink', blinkCursor);
    term.getPrefs().set('cursor-shape', cursorShape);
    syncFontMetricsWhenReady(fontFamily, fontSize, foregroundColor,
                             backgroundColor);
};

exports.getCharacterSize = () => {
    return [term.scrollPort_.characterSize.width, term.scrollPort_.characterSize.height];
};

exports.clearScrollback = () => term.clearScrollback();
exports.setUserGesture = () => term.accessibilityReader_.hasUserGesture = true;

hterm.openUrl = (url) => native.openLink(url);

native.load();
native.syncFocus();

}
