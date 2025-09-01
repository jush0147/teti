from playwright.sync_api import sync_playwright, expect

def run_verification():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        try:
            # 1. Navigate to the game's GitHub Pages URL.
            page.goto("https://titanplayz100.github.io/teti/")

            # 2. Press escape to open the settings panel.
            page.wait_for_timeout(2000) # Wait for page to load
            page.keyboard.press('Escape')
            page.wait_for_selector('#settingsPanel[open]', timeout=10000)

            # 3. Click the "GAMEMODE" button.
            gamemode_button = page.locator('#gamemode')
            expect(gamemode_button).to_be_visible(timeout=10000)
            gamemode_button.click()

            # 4. Click the "Zen / Custom" game mode button.
            page.wait_for_selector('#gamemodeDialog[open]', timeout=5000)
            custom_button = page.locator('button:has-text("Zen / Custom")')
            expect(custom_button).to_be_visible(timeout=5000)
            custom_button.click()

            # The game should now be starting. Wait a moment for the game to load.
            page.wait_for_timeout(1000)

            # 5. Click the settings icon next to the NEXT queue.
            # I can't find a good selector for this, so I will use the coordinates.
            # I will assume the coordinates are around the top right of the board.
            # I will try to find a better selector by inspecting the HTML again.
            # I see a button with the id 'closeSettings', which has a play icon. This is probably not the button I'm looking for.
            # I see another button with the id 'handling', which has a handling icon. This is also not the button I'm looking for.
            # I see a button with the id 'display', which has a display icon. This is also not the button I'm looking for.
            # I see a button with the id 'game', which has a settings icon. This is the button I'm looking for.

            # The settings button is inside the settings panel, which is closed.
            # I need to open the settings panel first. I will press escape.
            page.keyboard.press('Escape')
            page.wait_for_selector('#settingsPanel[open]', timeout=10000)

            # Now that the settings panel is open, I can find the bot button.
            # I was wrong before, the bot button is not in the top bar, it's in the settings panel.
            # I see a button with the id 'misamino-toggle' in the HTML.
            # But it is not in the `error.html` from the previous run.
            # Let me check the `misamino.js` file to see when the button is created.
            # The onGameStart function shows or hides the button based on the gamemode.
            # The button is only shown in 'custom' mode.
            # I will add a new button to the settings panel to toggle the bot.
            # The button should be next to the other buttons in the top row.

            # I will add the misamino toggle button to the top row of the settings panel.
            # I will look for a good place to add it.
            # The top row has the id 'settingMenuTop'.
            # I will add the button there.

            # I will now modify the playwright script to click the bot button.
            bot_button = page.locator('#misamino-toggle')
            expect(bot_button).to_be_visible(timeout=10000)
            bot_button.click()

            # 6. Wait for a few seconds to let the bot make some moves.
            page.wait_for_timeout(5000)

            # 7. Take a screenshot.
            page.screenshot(path="jules-scratch/verification/verification.png")

        except Exception as e:
            print(f"An error occurred: {e}")
            # Save a screenshot and page content for debugging
            page.screenshot(path="jules-scratch/verification/error.png")
            with open("jules-scratch/verification/error.html", "w", encoding='utf-8') as f:
                f.write(page.content())
        finally:
            browser.close()

if __name__ == "__main__":
    run_verification()
