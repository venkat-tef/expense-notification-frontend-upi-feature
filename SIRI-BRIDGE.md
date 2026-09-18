# Nestly Siri / Apple Shortcuts Bridge

Nestly is a web/PWA application, so the bridge uses **Apple Shortcuts + a Nestly URL** rather than pretending the PWA is a native iOS App Intent.

## What it supports

The Shortcut can pass the dictated sentence using `voiceCommand` to the same `VoiceCommandService` used by Nestly's on-screen assistant. This keeps Siri and Nestly on one command contract.

Supported command families currently exposed by the app:

- Inventory: show all inventory, kitchen/fridge contents, check an item, add an item, mark an item available/low/out.
- Water: today's water duty/turn.
- Garbage: today's garbage duty/turn.
- Expenses: current-month expense summary.
- Navigation: Home, Inventory, Expenses, Water, Garbage, History, Settings.
- English, Telugu and Tenglish phrases that the existing parser/Gemini fallback understands.
- Confirmation follow-up: `yes`, `no`, `avunu`, `vaddu`, etc. are resolved locally when a pending inventory change exists.

## Shortcut flow

1. Create an Apple Shortcut named **Nestly**.
2. Add **Dictate Text**.
3. Add **URL** with:
   `https://YOUR-NESTLY-HOST/dashboard?voiceCommand=[Dictated Text]`
4. Add **Open URLs**.
5. For commands that change inventory, keep confirmation in the Shortcut or send `confirmed=1` only after the Shortcut has explicitly asked the user to confirm.

The bridge accepts `voiceCommand` (as well as the older `command`/`siriCommand` forms) and removes its query parameters immediately, so refreshing the page does not repeat the command.

## Important platform limitation

Siri itself does not receive arbitrary spoken responses from a browser/PWA URL. The bridge therefore executes the command inside the authenticated Nestly PWA and uses Nestly's existing speech service for audible feedback. If a future native iOS app is added, the same command contract can be exposed through App Intents for a fully native Siri request/response experience.
