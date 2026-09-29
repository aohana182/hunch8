// HelpDialog in MainScreen.kt, as a native <dialog>: modal, Esc closes it,
// the backdrop blocks the page, and focus goes back to the "?" button.
export function setUpHelp(button: HTMLButtonElement, dialog: HTMLDialogElement) {
  button.addEventListener("click", () => dialog.showModal());

  // Tapping the scrim dismisses it, like onDismissRequest on Android.
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });

  dialog.addEventListener("close", () => button.focus());
}
