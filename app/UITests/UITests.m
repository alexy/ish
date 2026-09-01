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

@end
