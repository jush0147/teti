// assets/coldclear/coldclear-worker.js
import init, { bot_io } from './cold_clear_2.js';

async function setup() {
    try {
        // Initialize the wasm module. The path to the .wasm file is relative
        // to this worker file.
        await init('./cold_clear_2_bg.wasm');

        // Set up the message handler after wasm is initialized.
        self.onmessage = (e) => {
            try {
                // The main application sends a message that is expected to be
                // compatible with the bot's IO format.
                const request = e.data;

                // Call the bot's primary IO function.
                const response = bot_io(request);

                // Send the bot's response back to the main thread.
                postMessage(response);
            } catch (error) {
                console.error('Error in Cold Clear worker onmessage:', error);
                // Optionally, send an error message back to the main thread
                postMessage({ type: 'error', message: 'Failed to process message in worker.' });
            }
        };

        // Send a 'ready' message to the main thread to signal that the worker
        // has been initialized successfully.
        postMessage({ type: 'ready' });

    } catch (error) {
        console.error('Error initializing Cold Clear worker:', error);
        // Send an error message back to the main thread if initialization fails.
        postMessage({ type: 'error', message: 'Cold Clear worker initialization failed.' });
    }
}

setup();
