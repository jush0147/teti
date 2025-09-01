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

            # 5. Enable the bot by clicking the in-game button
            ingame_bot_button = page.locator('#misamino-ingame')
            expect(ingame_bot_button).to_be_visible(timeout=5000)
            ingame_bot_button.click()

            # 6. Wait for a few seconds to let the bot make some moves.
            page.wait_for_timeout(5000) # 5 seconds

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
