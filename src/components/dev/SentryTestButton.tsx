import * as Sentry from "@sentry/astro";

export default function SentryTestButton() {
  function handleClick() {
    Sentry.logger.info(Sentry.logger.fmt`User ${"sentry-test"} triggered test error button`, {
      action: "test_error_button_click",
    });
    Sentry.metrics.count("test_counter", 1);
    throw new Error("This is a test error");
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="w-full rounded-lg bg-purple-600 px-4 py-2 font-medium hover:bg-purple-500"
    >
      Throw test error
    </button>
  );
}
