//
//  UITests.m
//  UITests
//
//  Created by Theodore Dubois on 11/13/20.
//

#import <XCTest/XCTest.h>

@interface UITests : XCTestCase
@end

@implementation UITests

- (void)setUp {
    self.continueAfterFailure = NO;
}

- (void)testTerminalPinchGesture {
    XCUIApplication *app = [XCUIApplication new];
    [app launch];

    XCUIElement *window = app.windows.firstMatch;
    XCTAssertTrue([window waitForExistenceWithTimeout:10]);
    [window pinchWithScale:1.5 velocity:1];
    [window pinchWithScale:0.75 velocity:-1];
}

- (void)setReaderBarVisible:(BOOL)visible inApplication:(XCUIApplication *)app {
    [app.buttons[@"Settings"] tap];

    XCUIElement *table = app.tables.firstMatch;
    XCUIElement *readerBarSwitch = app.switches[@"Show Dante Reader Bar"];
    for (NSUInteger attempt = 0; attempt < 6 && !readerBarSwitch.hittable; attempt++)
        [table swipeUp];
    XCTAssertTrue(readerBarSwitch.hittable);

    if ([readerBarSwitch.value boolValue] != visible)
        [readerBarSwitch tap];
    [app.navigationBars[@"Settings"].buttons[@"Done"] tap];

    XCUIElement *nextWord = app.buttons[@"Next word"];
    NSPredicate *visibility = [NSPredicate predicateWithFormat:@"exists == %@", @(visible)];
    XCTNSPredicateExpectation *transition = [[XCTNSPredicateExpectation alloc]
        initWithPredicate:visibility object:nextWord];
    XCTAssertEqual([XCTWaiter waitForExpectations:@[transition] timeout:5],
                   XCTWaiterResultCompleted);
}

- (void)testReaderBarVisibilityKeepsTerminalVisible {
    XCUIApplication *app = [XCUIApplication new];
    [app launch];

    XCUIElement *terminal = app.webViews.firstMatch;
    XCUIElement *welcome = [app.webViews.staticTexts
        matchingPredicate:[NSPredicate predicateWithFormat:@"label CONTAINS %@",
                                                       @"Welcome to Alpine"]].firstMatch;
    XCTAssertTrue([welcome waitForExistenceWithTimeout:10]);

    [self setReaderBarVisible:YES inApplication:app];
    CGFloat shownHeight = terminal.frame.size.height;
    for (NSUInteger cycle = 0; cycle < 2; cycle++) {
        [self setReaderBarVisible:NO inApplication:app];
        XCTAssertTrue(welcome.exists);
        XCTAssertGreaterThan(terminal.frame.size.height, shownHeight + 20);

        [self setReaderBarVisible:YES inApplication:app];
        XCTAssertTrue(welcome.exists);
        XCTAssertEqualWithAccuracy(terminal.frame.size.height, shownHeight, 1);
    }
}

@end
