import { Page } from '@playwright/test';

/**
 * Injects a mock SpeechRecognition implementation into the browser page.
 * This mocks both window.SpeechRecognition and window.webkitSpeechRecognition.
 */
export async function injectMockSpeechRecognition(page: Page) {
    await page.addInitScript(() => {
        console.log('Injecting MockSpeechRecognition utils');

        class MockSpeechRecognition extends EventTarget {
            continuous = false;
            interimResults = false;
            lang = '';

            constructor() {
                super();
                console.log('MockSpeechRecognition instantiated');
            }

            start() {
                console.log('MockSpeechRecognition.start() called');
                this.dispatchEvent(new Event('start'));
                if (this.onstart) this.onstart(new Event('start'));

                // Simulate speech happening after a short delay
                setTimeout(() => {
                    console.log('Simulating result');
                    this.simulateResult('Hello Playwright');
                }, 500);
            }

            stop() {
                console.log('MockSpeechRecognition.stop() called');
                this.dispatchEvent(new Event('end'));
                if (this.onend) this.onend(new Event('end'));
            }

            abort() {
                this.dispatchEvent(new Event('end'));
                if (this.onend) this.onend(new Event('end'));
            }

            simulateResult(transcript: string) {
                const event = {
                    resultIndex: 0,
                    results: {
                        length: 1,
                        0: {
                            isFinal: true,
                            0: { transcript }
                        }
                    }
                };
                if (this.onresult) {
                    (this.onresult as any)(event);
                } else {
                    console.log('No onresult handler set');
                }
            }

            onresult: any = null;
            onstart: any = null;
            onend: any = null;
            onerror: any = null;
        }

        // @ts-ignore
        window.SpeechRecognition = MockSpeechRecognition;
        // @ts-ignore
        window.webkitSpeechRecognition = MockSpeechRecognition;
    });
}
